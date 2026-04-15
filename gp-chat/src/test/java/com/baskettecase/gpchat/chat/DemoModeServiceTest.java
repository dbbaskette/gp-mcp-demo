package com.baskettecase.gpchat.chat;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DemoModeServiceTest {

    @Test
    void fansOutToEachPersona() {
        ChatOrchestrator orch = mock(ChatOrchestrator.class);
        doAnswer(inv -> {
            String p = inv.getArgument(1);
            java.util.function.Consumer<Object> sink = inv.getArgument(5);
            sink.accept(WireMessages.AssistantDone.of(p));
            return null;
        }).when(orch).handle(anyString(), anyString(), anyString(), anyString(), anyString(), any());

        var demo = new DemoModeService(orch);
        var events = new CopyOnWriteArrayList<>();
        demo.fanOut("s1",
            new WireMessages.DemoMessage(List.of("viewer", "analyst", "dba"), "hi", "openai", "gpt-4o-mini"),
            events::add);

        assertThat(events).hasSize(3);
        verify(orch, times(3)).handle(eq("s1"), anyString(), eq("hi"), eq("openai"), eq("gpt-4o-mini"), any());
    }
}
