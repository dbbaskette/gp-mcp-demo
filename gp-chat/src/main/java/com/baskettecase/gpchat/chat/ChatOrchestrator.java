package com.baskettecase.gpchat.chat;

import com.baskettecase.gpchat.llm.ModelRegistry;
import com.baskettecase.gpchat.mcp.McpGateway;
import com.baskettecase.gpchat.mcp.NotLoggedInException;
import org.springframework.ai.chat.client.ChatClient;
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

    private static final String SYSTEM_PROMPT = """
        You are a helpful data analyst assistant that answers questions about a Greenplum database.
        You have access to MCP tools that operate under the current user's identity and permissions —
        the database may deny operations, that's expected and should be reported calmly.

        OUTPUT FORMATTING RULES:
        - Use markdown for prose.
        - When you produce a summary of query results, wrap the summary in a <card title="..."> block.
        - For key stats, use: <statgrid><stat label="..." value="..." sub="..." /></statgrid> (2-4 stats).
        - For tabular results, use a standard markdown table OR <datatable> with <thead>/<tbody>/<tr>/<td>.
        - Do NOT emit <script>, <iframe>, <style>, on* attributes, or javascript: URLs.
        - Keep prose concise. Let the card carry the visual weight.
        """;

    private final ModelRegistry models;
    private final McpGateway mcp;
    private final ConversationStore conversations;
    private final AuditEventBus audit;

    public ChatOrchestrator(ModelRegistry models, McpGateway mcp, ConversationStore conversations, AuditEventBus audit) {
        this.models = models;
        this.mcp = mcp;
        this.conversations = conversations;
        this.audit = audit;
    }

    public void handle(String sessionId, String personaId, String content, String providerId, String modelId,
                       Consumer<Object> sink) {
        List<ToolCallback> callbacks;
        try {
            callbacks = mcp.listTools(sessionId, personaId).stream()
                .<ToolCallback>map(t -> FunctionToolCallback
                    .builder(t.name(), (Map<String, Object> args) -> callAndAudit(sessionId, personaId, t.name(), args, sink))
                    .description(t.description())
                    .inputType(Map.class)
                    .build())
                .toList();
        } catch (NotLoggedInException nle) {
            sink.accept(WireMessages.AuthRequired.of(personaId));
            return;
        }

        var chatModel = models.resolve(providerId, modelId);
        var chat = ChatClient.create(chatModel);
        var history = conversations.load(sessionId, personaId);
        history.add(new UserMessage(content));

        var response = chat.prompt()
            .system(SYSTEM_PROMPT)
            .messages(history)
            .toolCallbacks(callbacks.toArray(new ToolCallback[0]))
            .call()
            .content();

        sink.accept(WireMessages.AssistantDelta.of(personaId, response));
        sink.accept(WireMessages.AssistantDone.of(personaId));
    }

    private String callAndAudit(String sessionId, String personaId, String name, Map<String, Object> args, Consumer<Object> sink) {
        String callId = UUID.randomUUID().toString();
        sink.accept(WireMessages.ToolCallStart.of(personaId, callId, name, args));
        long t0 = System.nanoTime();
        var res = mcp.callTool(sessionId, personaId, name, args);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        sink.accept(WireMessages.ToolCallResult.of(personaId, callId, res.status(), res.content()));
        audit.record(new AuditEventBus.AuditEvent(Instant.now(), personaId, name, res.status(), ms, args));
        return String.valueOf(res.content());
    }
}
