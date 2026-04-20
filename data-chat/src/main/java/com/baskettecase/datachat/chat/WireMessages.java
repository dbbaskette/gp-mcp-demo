package com.baskettecase.datachat.chat;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.List;
import java.util.Map;

public final class WireMessages {
    private WireMessages() {}

    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
    @JsonSubTypes({
        @JsonSubTypes.Type(value = UserMessage.class, name = "user_message"),
        @JsonSubTypes.Type(value = DemoMessage.class, name = "demo_message"),
        @JsonSubTypes.Type(value = Reset.class,       name = "reset")
    })
    public sealed interface Inbound permits UserMessage, DemoMessage, Reset {}

    public record UserMessage(String personaId, String content, String providerId, String modelId) implements Inbound {}
    public record DemoMessage(List<String> personaIds, String content, String providerId, String modelId) implements Inbound {}
    public record Reset(String personaId) implements Inbound {}

    public record AssistantDelta(String type, String personaId, String text) {
        public static AssistantDelta of(String p, String t) { return new AssistantDelta("assistant_delta", p, t); }
    }
    public record AssistantDone(String type, String personaId) {
        public static AssistantDone of(String p) { return new AssistantDone("assistant_done", p); }
    }
    public record ToolCallStart(String type, String personaId, String id, String name, Map<String, Object> args) {
        public static ToolCallStart of(String p, String id, String n, Map<String, Object> a) {
            return new ToolCallStart("tool_call_start", p, id, n, a);
        }
    }
    public record ToolCallResult(String type, String personaId, String id, String status, Object result) {
        public static ToolCallResult of(String p, String id, String s, Object r) {
            return new ToolCallResult("tool_call_result", p, id, s, r);
        }
    }
    public record AuthRequired(String type, String personaId) {
        public static AuthRequired of(String p) { return new AuthRequired("auth_required", p); }
    }
    public record Error(String type, String personaId, String code, String message) {
        public static Error of(String p, String c, String m) { return new Error("error", p, c, m); }
    }
}
