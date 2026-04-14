package com.baskettecase.gpchat.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper om = new ObjectMapper();
    private final ChatOrchestrator orchestrator;
    private final DemoModeService demoMode;
    private final ConversationStore conversations;
    private final Executor exec = Executors.newVirtualThreadPerTaskExecutor();

    public ChatWebSocketHandler(ChatOrchestrator o, DemoModeService d, ConversationStore cs) {
        this.orchestrator = o;
        this.demoMode = d;
        this.conversations = cs;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage msg) throws Exception {
        var in = om.readValue(msg.getPayload(), WireMessages.Inbound.class);
        String httpSessionId = (String) session.getAttributes().get("HTTP.SESSION.ID");
        if (httpSessionId == null) httpSessionId = session.getId();

        final String sid = httpSessionId;
        exec.execute(() -> {
            try {
                switch (in) {
                    case WireMessages.UserMessage u ->
                        orchestrator.handle(sid, u.personaId(), u.content(), u.providerId(), u.modelId(), ev -> send(session, ev));
                    case WireMessages.DemoMessage d ->
                        demoMode.fanOut(sid, d, ev -> send(session, ev));
                    case WireMessages.Reset r ->
                        conversations.reset(sid, r.personaId());
                }
            } catch (Exception e) {
                send(session, WireMessages.Error.of(null, "orchestrator_error", e.getMessage()));
            }
        });
    }

    private void send(WebSocketSession session, Object event) {
        try {
            if (session.isOpen()) session.sendMessage(new TextMessage(om.writeValueAsString(event)));
        } catch (IOException ignored) {}
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {}
}
