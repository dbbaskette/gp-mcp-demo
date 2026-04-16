package com.baskettecase.gpchat.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.baskettecase.gpchat.llm.ModelRegistry;
import com.baskettecase.gpchat.mcp.McpClientRegistry;
import com.baskettecase.gpchat.mcp.McpGateway;
import com.baskettecase.gpchat.mcp.NotLoggedInException;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.function.FunctionToolCallback;
import org.springframework.stereotype.Component;



import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ChatOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(ChatOrchestrator.class);

    private static final String SYSTEM_PROMPT = """
        You are a data analyst assistant connected to a Greenplum database via MCP tools.
        You operate under the current user's identity and permissions.

        === CORE RULES ===
        1. Answer ONLY what the user asked. Do not volunteer extra information about your tools,
           capabilities, or the environment unless specifically asked.
        2. Use MCP tools to get real data. Never guess or fabricate results.
        3. If a query fails due to permissions, report the exact error briefly.
        4. Keep responses short and focused on the data.

        === OUTPUT FORMAT (MANDATORY) ===
        EVERY response that shows database data MUST be wrapped in a <card> element. A raw
        markdown table or bare prose outside a <card> is WRONG. The UI renders <card>,
        <statgrid>/<stat>, and markdown tables with rich styling; plain text looks broken.

        Card wrapper — always required around data output:

            <card title="Short Title" color="blue">
            ...content...
            </card>

        Color semantics (pick the one that matches the situation):
        - blue    → informational results, schema info, general data (DEFAULT)
        - green   → success, table created, query succeeded, operation completed
        - red     → errors, permission denied, failures, blocked operations
        - amber   → warnings, partial results, read-only notices
        - purple  → analytics results, aggregations, query plans
        - teal    → metadata, configuration, system info

        For 1-4 headline numbers (row counts, sizes, durations), prefer <statgrid> over a table:

            <statgrid>
            <stat label="Total Rows" value="1,245,892" sub="across 12 tables" />
            <stat label="DB Size" value="2.1 GB" />
            </statgrid>

        For tabular data (multiple rows × multiple columns), use a GFM markdown table INSIDE
        the card. CRITICAL: each row MUST be on its own line with a real newline, including
        the header and separator rows. Do not collapse rows onto one line. Blank line before
        the table is fine.

        === FEW-SHOT EXAMPLES ===

        User: "how many rows in the customer table?"
        Correct response:
            <card title="customer row count" color="blue">
            <statgrid>
            <stat label="Rows" value="100,000" />
            </statgrid>
            </card>

        User: "show me the largest table"
        Correct response:
            <card title="Largest Table" color="purple">
            <statgrid>
            <stat label="Table" value="public.inventory" />
            <stat label="Size" value="493.4 MB" />
            </statgrid>
            </card>

        User: "list the top 3 largest tables"
        Correct response:
            <card title="Top 3 Largest Tables" color="purple">

            | Table | Schema | Size |
            | --- | --- | --- |
            | inventory | public | 493.4 MB |
            | store_sales | public | 400.8 MB |
            | catalog_sales | public | 288.8 MB |

            </card>

        User: "drop the customer table" (denied)
        Correct response:
            <card title="Permission Denied" color="red">
            The viewer role does not have DROP permission on public.customer.
            </card>

        === SAFETY ===
        NEVER emit <script>, <iframe>, <style>, on* event attributes, or javascript: URLs.
        Do NOT list your tools or capabilities unless the user explicitly asks.
        """;

    private final ModelRegistry models;
    private final McpGateway mcp;
    private final ConversationStore conversations;
    private final AuditEventBus audit;
    private final ObjectMapper om = new ObjectMapper();

    public ChatOrchestrator(ModelRegistry models, McpGateway mcp, ConversationStore conversations, AuditEventBus audit) {
        this.models = models;
        this.mcp = mcp;
        this.conversations = conversations;
        this.audit = audit;
    }

    public void handle(String sessionId, String personaId, String content, String providerId, String modelId,
                       Consumer<Object> sink) {
        log.info("handle() start: persona={}, provider={}, model={}", personaId, providerId, modelId);

        // Open a turn-scoped MCP session
        McpClientRegistry.McpSession mcpSession;
        List<ToolCallback> callbacks;
        try {
            mcpSession = mcp.openTurnSession(sessionId, personaId);
            log.info("MCP session opened for persona={}", personaId);
            var tools = mcp.listTools(mcpSession);
            log.info("Got {} tools for persona={}", tools.size(), personaId);

            callbacks = tools.stream()
                .<ToolCallback>map(t -> {
                    String schema;
                    try { schema = om.writeValueAsString(t.inputSchema()); }
                    catch (Exception e) { schema = "{\"type\":\"object\"}"; }
                    // MCP servers emit schemas that are valid JSON Schema but that various
                    // LLM providers reject. Normalize them into a cross-provider-safe shape.
                    schema = sanitizeToolSchema(schema);
                    return (ToolCallback) FunctionToolCallback
                        .builder(t.name(), (Map<String, Object> args) -> callAndAudit(mcpSession, personaId, t.name(), args, sink))
                        .description(t.description())
                        .inputSchema(schema)
                        .inputType(Map.class)
                        .build();
                })
                .toList();
            log.info("Built {} callbacks for persona={}", callbacks.size(), personaId);
        } catch (NotLoggedInException nle) {
            sink.accept(WireMessages.AuthRequired.of(personaId));
            return;
        } catch (Exception e) {
            log.error("MCP setup failed for persona={}", personaId, e);
            sink.accept(WireMessages.Error.of(personaId, "mcp_error", "MCP connection failed: " + e.getMessage()));
            return;
        }

        log.info("Resolving model: provider={}, model={}", providerId, modelId);
        var chatModel = models.resolve(providerId, modelId);
        var chat = ChatClient.create(chatModel);
        log.info("Calling LLM for persona={}", personaId);
        var history = conversations.load(sessionId, personaId);
        history.add(new UserMessage(content));

        audit.recordLlm(personaId, providerId, modelId, "start", 0, "prompt: " + content.substring(0, Math.min(content.length(), 120)));
        long t0 = System.nanoTime();
        String response;
        try {
            var promptSpec = chat.prompt()
                .system(SYSTEM_PROMPT)
                .messages(history)
                .toolCallbacks(callbacks.toArray(new ToolCallback[0]));
            // LM Studio shares a single bean across multiple configured models; override the
            // model on each call so the user's UI selection is respected. Other providers
            // already have model baked into their bean options.
            ChatOptions.Builder<?> perCallOptions = perCallOptionsFor(providerId, modelId);
            if (perCallOptions != null) {
                promptSpec = promptSpec.options(perCallOptions);
            }
            response = promptSpec.call().content();
        } catch (Exception e) {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            // Audit-bus-only recording makes LLM failures invisible in the server log, which
            // looks exactly like a silent hang when debugging. Log it plainly too.
            log.error("LLM call failed: provider={}, model={}, message={}", providerId, modelId, e.getMessage(), e);
            audit.recordLlm(personaId, providerId, modelId, "error", ms, e.getMessage());
            sink.accept(WireMessages.Error.of(personaId, "llm_error", e.getMessage()));
            return;
        }
        long ms = (System.nanoTime() - t0) / 1_000_000;
        audit.recordLlm(personaId, providerId, modelId, "done", ms, "response length: " + (response != null ? response.length() : 0));

        // Some models (notably smaller local models via LM Studio) emit GFM tables with the
        // header, separator, and data rows all glued onto a single line. The GFM parser needs
        // real newlines between rows, so repair that shape before the response leaves the server.
        response = normalizeMarkdownTables(response);

        // Save assistant response to history for proper user→assistant→user flow
        if (response != null) {
            history.add(new AssistantMessage(response));
        }

        sink.accept(WireMessages.AssistantDelta.of(personaId, response));
        sink.accept(WireMessages.AssistantDone.of(personaId));
    }

    // A GFM table separator cell is `---`, `:---`, `---:`, or `:---:` optionally surrounded by
    // spaces. A full separator row has two or more such cells. If we find that pattern on a
    // single line, the header and data rows are almost certainly fused onto that line too.
    private static final Pattern TABLE_SEPARATOR = Pattern.compile(
        "\\| *:?-{3,}:? *(?:\\| *:?-{3,}:? *)+\\|"
    );

    String normalizeMarkdownTables(String text) {
        if (text == null || text.indexOf('|') < 0) return text;
        String[] lines = text.split("\n", -1);
        boolean changed = false;
        for (int i = 0; i < lines.length; i++) {
            String rewritten = rewriteCollapsedTableLine(lines[i]);
            if (!rewritten.equals(lines[i])) {
                lines[i] = rewritten;
                changed = true;
            }
        }
        return changed ? String.join("\n", lines) : text;
    }

    private String rewriteCollapsedTableLine(String line) {
        Matcher m = TABLE_SEPARATOR.matcher(line);
        if (!m.find()) return line;

        // Cell count from the separator row: one fewer than its pipe count.
        int cells = countChar(m.group(), '|') - 1;
        if (cells < 1) return line;
        int pipesPerRow = cells + 1;
        int sepStart = m.start();
        int sepEnd = m.end();

        // Walk back from the separator to the start of the header row by counting pipes.
        // A header row contributes exactly pipesPerRow pipes and sits on the same line.
        int tableStart = findHeaderStart(line, sepStart, pipesPerRow);
        if (tableStart < 0) return line;

        // Walk forward past any number of data rows on the same line.
        int tableEnd = findDataEnd(line, sepEnd, pipesPerRow);

        // Now tokenize just the table substring and validate it fits R*(pipesPerRow)+1 tokens.
        String tableSpan = line.substring(tableStart, tableEnd);
        String[] tokens = tableSpan.split("\\|", -1);
        int stride = pipesPerRow;
        if ((tokens.length - 1) % stride != 0) return line;
        int rows = (tokens.length - 1) / stride;
        if (rows < 2) return line;
        for (int r = 1; r < rows; r++) {
            if (!tokens[r * stride].trim().isEmpty()) return line;
        }

        StringBuilder normalized = new StringBuilder();
        for (int r = 0; r < rows; r++) {
            if (r > 0) normalized.append('\n');
            normalized.append('|');
            for (int c = 0; c < cells; c++) {
                normalized.append(' ').append(tokens[r * stride + 1 + c].trim()).append(" |");
            }
        }

        // Splice prose before/after back around the normalized table with blank-line separation
        // so the GFM parser treats the table as its own block-level element.
        String before = stripTrailing(line.substring(0, tableStart));
        String after = stripLeading(line.substring(tableEnd));
        StringBuilder out = new StringBuilder();
        if (!before.isEmpty()) out.append(before).append("\n\n");
        out.append(normalized);
        if (!after.isEmpty()) out.append("\n\n").append(after);
        return out.toString();
    }

    /** Index of the pipe that starts the header row (pipesPerRow pipes before the separator). */
    private static int findHeaderStart(String line, int separatorStart, int pipesPerRow) {
        int pipes = 0;
        for (int i = separatorStart - 1; i >= 0; i--) {
            char c = line.charAt(i);
            if (c == '\n') return -1;
            if (c == '|') {
                pipes++;
                if (pipes == pipesPerRow) return i;
            }
        }
        return -1;
    }

    /** Index just past the closing pipe of the last data row that keeps matching. */
    private static int findDataEnd(String line, int separatorEnd, int pipesPerRow) {
        int end = separatorEnd;
        int i = separatorEnd;
        while (i < line.length()) {
            // Skip inter-row gap (spaces/tabs — not newlines, since we're working on one line).
            while (i < line.length() && (line.charAt(i) == ' ' || line.charAt(i) == '\t')) i++;
            if (i >= line.length() || line.charAt(i) != '|') break;
            int pipes = 0;
            int j = i;
            while (j < line.length() && line.charAt(j) != '\n') {
                if (line.charAt(j) == '|') {
                    pipes++;
                    j++;
                    if (pipes == pipesPerRow) break;
                } else {
                    j++;
                }
            }
            if (pipes != pipesPerRow) break;
            end = j;
            i = j;
        }
        return end;
    }

    private static String stripTrailing(String s) {
        int end = s.length();
        while (end > 0 && Character.isWhitespace(s.charAt(end - 1))) end--;
        return s.substring(0, end);
    }

    private static String stripLeading(String s) {
        int start = 0;
        while (start < s.length() && Character.isWhitespace(s.charAt(start))) start++;
        return s.substring(start);
    }

    private int countChar(String s, char c) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) if (s.charAt(i) == c) n++;
        return n;
    }

    private ChatOptions.Builder<?> perCallOptionsFor(String providerId, String modelId) {
        if ("lmstudio".equals(providerId)) {
            return OpenAiChatOptions.builder().model(modelId);
        }
        return null;
    }

    /**
     * Normalize an MCP-declared tool schema into a shape every provider we support will accept.
     *
     * Problems we've hit in the wild:
     * <ul>
     *   <li>LM Studio rejects {@code {"type":"object"}} without a {@code properties} field once
     *       Spring AI tacks on {@code strict:true}. Fix: inject {@code properties:{}}.</li>
     *   <li>Google Gemini rejects {@code {"type":"array"}} without an {@code items} schema.
     *       Fix: default to {@code items:{"type":"string"}}.</li>
     *   <li>Gemini rejects {@code enum} arrays containing an empty string. Fix: drop empty
     *       entries, and drop the {@code enum} field entirely if nothing is left.</li>
     * </ul>
     * OpenAI and Anthropic tolerate the original shapes, so this sanitizer only ever makes
     * schemas <em>more</em> permissive.
     */
    String sanitizeToolSchema(String schemaJson) {
        try {
            var node = om.readTree(schemaJson);
            sanitizeSchemaNode(node);
            return om.writeValueAsString(node);
        } catch (Exception e) {
            return schemaJson;
        }
    }

    private void sanitizeSchemaNode(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || !node.isObject()) return;
        var obj = (com.fasterxml.jackson.databind.node.ObjectNode) node;
        String type = obj.path("type").asText("");

        if ("object".equals(type) && !obj.has("properties")) {
            obj.set("properties", om.createObjectNode());
        }
        if ("array".equals(type) && !obj.has("items")) {
            var fallback = om.createObjectNode();
            fallback.put("type", "string");
            obj.set("items", fallback);
        }

        // Drop empty-string enum entries (Gemini rejects them). If nothing is left, drop enum.
        if (obj.has("enum") && obj.get("enum").isArray()) {
            var arr = (com.fasterxml.jackson.databind.node.ArrayNode) obj.get("enum");
            var cleaned = om.createArrayNode();
            for (var e : arr) {
                if (e.isTextual() && e.asText().isEmpty()) continue;
                cleaned.add(e);
            }
            if (cleaned.isEmpty()) obj.remove("enum");
            else obj.set("enum", cleaned);
        }

        // Recurse into nested schema-bearing positions.
        if (obj.has("properties") && obj.get("properties").isObject()) {
            obj.get("properties").fields().forEachRemaining(e -> sanitizeSchemaNode(e.getValue()));
        }
        if (obj.has("items")) sanitizeSchemaNode(obj.get("items"));
        if (obj.has("additionalProperties")) sanitizeSchemaNode(obj.get("additionalProperties"));
        for (String combinator : new String[] { "anyOf", "oneOf", "allOf" }) {
            if (obj.has(combinator) && obj.get(combinator).isArray()) {
                for (var child : obj.get(combinator)) sanitizeSchemaNode(child);
            }
        }
    }

    private String callAndAudit(McpClientRegistry.McpSession mcpSession, String personaId, String name, Map<String, Object> args, Consumer<Object> sink) {
        String callId = UUID.randomUUID().toString();
        sink.accept(WireMessages.ToolCallStart.of(personaId, callId, name, args));
        long t0 = System.nanoTime();
        var res = mcp.callTool(mcpSession, personaId, name, args);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        sink.accept(WireMessages.ToolCallResult.of(personaId, callId, res.status(), res.content()));
        audit.record(new AuditEventBus.AuditEvent(Instant.now(), personaId, name, res.status(), ms, args));
        return String.valueOf(res.content());
    }
}
