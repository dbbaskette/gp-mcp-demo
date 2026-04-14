package com.baskettecase.gpchat.llm;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
            @Value("${spring.ai.openai.api-key:}") String openAiKey,
            @Value("${spring.ai.anthropic.api-key:}") String anthropicKey,
            @Value("${spring.ai.vertex.ai.gemini.project-id:}") String geminiProject,
            ObjectProvider<org.springframework.ai.vertexai.gemini.VertexAiGeminiChatModel> geminiProvider
        ) {
            Map<String, ProviderEntry> m = new LinkedHashMap<>();
            m.put("openai", new ProviderEntry(openAiKey.isBlank() ? null : openAi,
                List.of("gpt-4o", "gpt-4o-mini", "gpt-4.1-mini")));
            m.put("anthropic", new ProviderEntry(anthropicKey.isBlank() ? null : anthropic,
                List.of("claude-sonnet-4-5-20250514", "claude-haiku-4-5-20251001")));
            var gemini = geminiProvider.getIfAvailable();
            m.put("gemini", new ProviderEntry(geminiProject.isBlank() ? null : gemini,
                List.of("gemini-2.5-pro", "gemini-2.5-flash")));
            return m;
        }
    }
}
