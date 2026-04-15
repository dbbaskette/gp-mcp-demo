package com.baskettecase.gpchat.chat;

import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

@Component
public class DemoModeService {

    private final ChatOrchestrator orchestrator;
    private final Executor exec = Executors.newCachedThreadPool();

    public DemoModeService(ChatOrchestrator orchestrator) { this.orchestrator = orchestrator; }

    public void fanOut(String sessionId, WireMessages.DemoMessage msg, Consumer<Object> sink) {
        Consumer<Object> safeSink = event -> { synchronized (sink) { sink.accept(event); } };

        var futures = msg.personaIds().stream()
            .map(pid -> CompletableFuture.runAsync(() -> {
                try {
                    orchestrator.handle(sessionId, pid, msg.content(), msg.providerId(), msg.modelId(), safeSink);
                } catch (Exception e) {
                    safeSink.accept(WireMessages.Error.of(pid, "persona_error", e.getMessage()));
                }
            }, exec))
            .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
    }
}
