package com.baskettecase.gpchat.mcp;

import com.baskettecase.gpchat.auth.PersonaSessionStore;
import com.baskettecase.gpchat.chat.AuditEventBus;
import com.baskettecase.gpchat.config.PersonaConfig;
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
    private final AuditEventBus audit;

    public McpGateway(PersonaConfig cfg, PersonaSessionStore store, McpClientRegistry registry, AuditEventBus audit) {
        this.cfg = cfg;
        this.store = store;
        this.registry = registry;
        this.audit = audit;
    }

    public record ToolDescriptor(String name, String description, Map<String, Object> inputSchema) {}
    public record ToolResult(String status, Object content) {}

    /**
     * Verify MCP connectivity at login time.
     */
    @SuppressWarnings("unchecked")
    public List<ToolDescriptor> verifyConnection(String clientId, String personaId) {
        var persona = lookup(personaId);
        var token = requireToken(clientId, personaId);
        audit.recordMcp(personaId, persona.mcpServer(), "connect", "verifying connection", null);
        try {
            var session = registry.initialize(persona.mcpServer(), token);
            var rawTools = registry.listTools(session);
            var tools = rawTools.stream().map(this::toDescriptor).toList();
            audit.recordMcp(personaId, persona.mcpServer(), "connected",
                tools.size() + " tools available", tools.stream().map(ToolDescriptor::name).toList());
            return tools;
        } catch (Exception e) {
            audit.recordMcp(personaId, persona.mcpServer(), "error", e.getMessage(), null);
            throw new RuntimeException("MCP verification failed for " + personaId + ": " + e.getMessage(), e);
        }
    }

    /**
     * Open a turn-scoped MCP session.
     */
    public McpClientRegistry.McpSession openTurnSession(String clientId, String personaId) {
        var persona = lookup(personaId);
        var token = requireToken(clientId, personaId);
        return registry.initialize(persona.mcpServer(), token);
    }

    public List<ToolDescriptor> listTools(McpClientRegistry.McpSession session) {
        return registry.listTools(session).stream().map(this::toDescriptor).toList();
    }

    @SuppressWarnings("unchecked")
    public ToolResult callTool(McpClientRegistry.McpSession session, String personaId, String name, Map<String, Object> args) {
        try {
            var result = registry.callTool(session, name, args);
            boolean isError = Boolean.TRUE.equals(result.get("isError"));
            String status = isError ? classify(result) : "success";
            return new ToolResult(status, result.get("content"));
        } catch (Exception e) {
            log.error("MCP tool call failed: {} for persona {}", name, personaId, e);
            audit.recordMcp(personaId, lookup(personaId).mcpServer(), "call_error", name + ": " + e.getMessage(), null);
            return new ToolResult("error", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private ToolDescriptor toDescriptor(Map<String, Object> raw) {
        String name = (String) raw.getOrDefault("name", "");
        String desc = (String) raw.getOrDefault("description", "");
        Map<String, Object> schema = (Map<String, Object>) raw.getOrDefault("inputSchema", Map.of());
        return new ToolDescriptor(name, desc, schema);
    }

    @SuppressWarnings("unchecked")
    private String classify(Map<String, Object> result) {
        String s = String.valueOf(result.get("content")).toLowerCase();
        if (s.contains("permission denied") || s.contains("not allowed") || s.contains("forbidden")) return "denied";
        return "error";
    }

    public PersonaConfig.Persona lookup(String personaId) {
        return cfg.personas().stream().filter(p -> p.id().equals(personaId)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("unknown persona: " + personaId));
    }

    public String requireToken(String clientId, String personaId) {
        return store.get(clientId, personaId)
            .map(PersonaSessionStore.PersonaToken::accessToken)
            .orElseThrow(() -> new NotLoggedInException(personaId));
    }
}
