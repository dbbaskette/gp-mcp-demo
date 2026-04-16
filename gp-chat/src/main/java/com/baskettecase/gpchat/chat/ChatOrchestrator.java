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
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.function.FunctionToolCallback;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

@Component
public class ChatOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(ChatOrchestrator.class);

    private static final String SYSTEM_PROMPT = """
        You are a data analyst assistant connected to a Greenplum database via MCP tools.
        You operate under the current user's identity and permissions.

        RULES:
        1. Answer ONLY what the user asked. Do not volunteer extra information about your tools,
           capabilities, or the environment unless specifically asked.
        2. Use MCP tools to get real data. Never guess or fabricate results.
        3. If a query fails due to permissions, report the exact error briefly.
        4. Keep responses short and focused on the data.

        FORMATTING — use these custom HTML elements:

        Wrap responses in a card with a semantic color:
        <card title="Short Title" color="blue">
        content here
        </card>

        Color values and when to use them:
        - color="blue"   → informational results, schema info, general data (DEFAULT)
        - color="green"  → success, table created, query succeeded, operation completed
        - color="red"    → errors, permission denied, failures, blocked operations
        - color="amber"  → warnings, partial results, read-only notices
        - color="purple" → analytics results, aggregations, query plans
        - color="teal"   → metadata, configuration, system info

        For 2-4 key numbers, use stat tiles (they auto-color by position):
        <statgrid>
        <stat label="Label" value="123" sub="optional detail" />
        </statgrid>

        For tabular data, use markdown tables inside the card.

        NEVER emit <script>, <iframe>, <style>, on* attributes, or javascript: URLs.
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
            response = chat.prompt()
                .system(SYSTEM_PROMPT)
                .messages(history)
                .toolCallbacks(callbacks.toArray(new ToolCallback[0]))
                .call()
                .content();
        } catch (Exception e) {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            audit.recordLlm(personaId, providerId, modelId, "error", ms, e.getMessage());
            sink.accept(WireMessages.Error.of(personaId, "llm_error", e.getMessage()));
            return;
        }
        long ms = (System.nanoTime() - t0) / 1_000_000;
        audit.recordLlm(personaId, providerId, modelId, "done", ms, "response length: " + (response != null ? response.length() : 0));

        // Save assistant response to history for proper user→assistant→user flow
        if (response != null) {
            history.add(new AssistantMessage(response));
        }

        sink.accept(WireMessages.AssistantDelta.of(personaId, response));
        sink.accept(WireMessages.AssistantDone.of(personaId));
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
