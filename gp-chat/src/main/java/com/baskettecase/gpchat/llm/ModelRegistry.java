package com.baskettecase.gpchat.llm;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class ModelRegistry {

    public record ProviderEntry(ChatModel model, List<String> models) {}
    public record ProviderView(String id, List<String> models) {}

    private final Map<String, ProviderEntry> providers;

    public ModelRegistry(Map<String, ProviderEntry> providers) {
        this.providers = providers;
    }

    public List<ProviderView> list() {
        return providers.entrySet().stream()
            .filter(e -> e.getValue().model() != null && !e.getValue().models().isEmpty())
            .map(e -> new ProviderView(e.getKey(), e.getValue().models()))
            .sorted(Comparator.comparing(ProviderView::id))
            .toList();
    }

    public ChatModel resolve(String providerId, String modelId) {
        var e = providers.get(providerId);
        if (e == null || e.model() == null) throw new IllegalArgumentException("unknown provider '" + providerId + "'");
        if (!e.models().contains(modelId)) throw new IllegalArgumentException("unknown model '" + modelId + "' for provider '" + providerId + "'");
        return e.model();
    }

    @Configuration
    static class Cfg {
        @Bean
        Map<String, ProviderEntry> providerEntries(
            @Autowired(required = false) OpenAiChatModel openAi,
            @Autowired(required = false) AnthropicChatModel anthropic,
            @Autowired(required = false) GoogleGenAiChatModel googleGenAi
        ) {
            Map<String, ProviderEntry> m = new LinkedHashMap<>();
            m.put("google", new ProviderEntry(googleGenAi,
                List.of("gemini-3.1-flash-lite-preview", "gemini-2.5-pro-preview-05-06")));
            m.put("openai", new ProviderEntry(openAi,
                List.of("gpt-4.1-nano")));
            m.put("anthropic", new ProviderEntry(anthropic,
                List.of("claude-sonnet-4-6")));
            return m;
        }
    }
}
