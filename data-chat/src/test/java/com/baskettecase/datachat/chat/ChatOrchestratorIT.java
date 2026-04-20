package com.baskettecase.datachat.chat;

import com.baskettecase.datachat.llm.ModelRegistry;
import com.baskettecase.datachat.mcp.McpGateway;
import com.baskettecase.datachat.mcp.NotLoggedInException;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ChatOrchestratorIT {

    @Test
    void emitsAuthRequired_whenPersonaNotLoggedIn() {
        var models = mock(ModelRegistry.class);
        var gateway = mock(McpGateway.class);
        when(gateway.openTurnSession(any(), any())).thenThrow(new NotLoggedInException("analyst"));

        var conversations = new ConversationStore();
        var audit = new AuditEventBus(event -> {});

        var orch = new ChatOrchestrator(models, gateway, conversations, audit);
        var events = new CopyOnWriteArrayList<>();
        orch.handle("sess-1", "analyst", "hello", "openai", "gpt-4o-mini", events::add);

        assertThat(events).hasSize(1)
            .first().isInstanceOf(WireMessages.AuthRequired.class);
        assertThat(((WireMessages.AuthRequired) events.get(0)).personaId()).isEqualTo("analyst");
    }

    @Test
    void noInteractionWithModel_whenNotLoggedIn() {
        var models = mock(ModelRegistry.class);
        var gateway = mock(McpGateway.class);
        when(gateway.openTurnSession(any(), any())).thenThrow(new NotLoggedInException("viewer"));

        var orch = new ChatOrchestrator(models, gateway, new ConversationStore(), new AuditEventBus(e -> {}));
        orch.handle("s", "viewer", "hi", "openai", "gpt-4o", new CopyOnWriteArrayList<>()::add);

        verifyNoInteractions(models);
    }
}
