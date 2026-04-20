package com.baskettecase.datachat.chat;

import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;

@Controller
@RequestMapping("/api/audit")
public class AuditStreamController {

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        var emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        return emitter;
    }

    @EventListener
    public void onAudit(AuditEventBus.AuditEvent ev) { broadcast("audit", ev); }

    @EventListener
    public void onLlm(AuditEventBus.LlmEvent ev) { broadcast("audit", ev); }

    @EventListener
    public void onMcp(AuditEventBus.McpEvent ev) { broadcast("audit", ev); }

    private void broadcast(String name, Object ev) {
        for (SseEmitter e : emitters) {
            try { e.send(SseEmitter.event().name(name).data(ev)); }
            catch (IOException io) { emitters.remove(e); }
        }
    }
}
