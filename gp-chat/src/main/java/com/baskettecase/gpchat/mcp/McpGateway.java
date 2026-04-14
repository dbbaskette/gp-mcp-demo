package com.baskettecase.gpchat.mcp;

import com.baskettecase.gpchat.auth.PersonaSessionStore;
import com.baskettecase.gpchat.config.PersonaConfig;
import io.modelcontextprotocol.spec.McpSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class McpGateway {

    private static final Logger log = LoggerFactory.getLogger(McpGateway.class);

    private final PersonaConfig cfg;
    private final PersonaSessionStore store;
    private final McpClientRegistry registry;

    public McpGateway(PersonaConfig cfg, PersonaSessionStore store, McpClientRegistry registry) {
        this.cfg = cfg;
        this.store = store;
        this.registry = registry;
    }

    public record ToolDescriptor(String name, String description, Map<String, Object> inputSchema) {}
    public record ToolResult(String status, Object content) {}

    public List<ToolDescriptor> listTools(String sessionId, String personaId) {
        var persona = lookup(personaId);
        var token = requireToken(sessionId, personaId);
        try (var client = registry.openClient(persona.mcpServer(), token)) {
            return client.listTools().tools().stream()
                .map(t -> new ToolDescriptor(t.name(), t.description(), jsonSchemaToMap(t.inputSchema())))
                .toList();
        }
    }

    public ToolResult callTool(String sessionId, String personaId, String name, Map<String, Object> args) {
        var persona = lookup(personaId);
        var token = requireToken(sessionId, personaId);
        try (var client = registry.openClient(persona.mcpServer(), token)) {
            McpSchema.CallToolResult r = client.callTool(new McpSchema.CallToolRequest(name, args));
            boolean err = r.isError() != null && r.isError();
            String status = err ? classify(r) : "success";
            return new ToolResult(status, r.content());
        } catch (Exception e) {
            log.error("MCP tool call failed: {} for persona {}", name, personaId, e);
            return new ToolResult("error", e.getMessage());
        }
    }

    private String classify(McpSchema.CallToolResult r) {
        String s = String.valueOf(r.content()).toLowerCase();
        if (s.contains("permission denied") || s.contains("not allowed") || s.contains("forbidden")) return "denied";
        return "error";
    }

    private PersonaConfig.Persona lookup(String personaId) {
        return cfg.personas().stream().filter(p -> p.id().equals(personaId)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("unknown persona: " + personaId));
    }

    private String requireToken(String sessionId, String personaId) {
        return store.get(sessionId, personaId)
            .map(PersonaSessionStore.PersonaToken::accessToken)
            .orElseThrow(() -> new NotLoggedInException(personaId));
    }

    private static Map<String, Object> jsonSchemaToMap(McpSchema.JsonSchema schema) {
        if (schema == null) return Map.of();
        Map<String, Object> m = new LinkedHashMap<>();
        if (schema.type() != null) m.put("type", schema.type());
        if (schema.properties() != null) m.put("properties", schema.properties());
        if (schema.required() != null) m.put("required", schema.required());
        if (schema.additionalProperties() != null) m.put("additionalProperties", schema.additionalProperties());
        return m;
    }
}
