package com.baskettecase.datachat.chat;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
public class AuditEventBus {

    public sealed interface DevEvent permits AuditEvent, LlmEvent, McpEvent {}

    public record AuditEvent(Instant at, String category, String personaId, String tool,
                             String status, long durationMs, Map<String, Object> args) implements DevEvent {
        public AuditEvent(Instant at, String personaId, String tool, String status, long durationMs, Map<String, Object> args) {
            this(at, "tool", personaId, tool, status, durationMs, args);
        }
    }

    public record LlmEvent(Instant at, String category, String personaId, String provider,
                            String model, String phase, long durationMs, String detail) implements DevEvent {}

    public record McpEvent(Instant at, String category, String personaId, String serverId,
                           String action, String detail, List<String> tools) implements DevEvent {}

    private final ApplicationEventPublisher pub;

    public AuditEventBus(ApplicationEventPublisher pub) { this.pub = pub; }

    public void record(AuditEvent e) { pub.publishEvent(e); }

    public void recordLlm(String personaId, String provider, String model, String phase, long durationMs, String detail) {
        pub.publishEvent(new LlmEvent(Instant.now(), "llm", personaId, provider, model, phase, durationMs, detail));
    }

    public void recordMcp(String personaId, String serverId, String action, String detail, List<String> tools) {
        pub.publishEvent(new McpEvent(Instant.now(), "mcp", personaId, serverId, action, detail, tools));
    }
}
