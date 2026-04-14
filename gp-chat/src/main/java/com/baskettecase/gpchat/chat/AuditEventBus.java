package com.baskettecase.gpchat.chat;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
public class AuditEventBus {
    public record AuditEvent(Instant at, String personaId, String tool, String status, long durationMs, Map<String, Object> args) {}

    private final ApplicationEventPublisher pub;

    public AuditEventBus(ApplicationEventPublisher pub) { this.pub = pub; }

    public void record(AuditEvent e) { pub.publishEvent(e); }
}
