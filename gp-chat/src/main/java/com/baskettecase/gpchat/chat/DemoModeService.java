package com.baskettecase.gpchat.chat;

import org.springframework.stereotype.Component;

import java.util.function.Consumer;

@Component
public class DemoModeService {
    // Stub — replaced in Task 9
    public void fanOut(String sessionId, WireMessages.DemoMessage msg, Consumer<Object> sink) {
        sink.accept(WireMessages.Error.of(null, "demo_not_implemented", "see Task 9"));
    }
}
