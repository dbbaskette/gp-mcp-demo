package com.baskettecase.datachat.llm;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
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
            @Autowired(required = false) @Qualifier("openAiChatModel") OpenAiChatModel openAi,
            @Autowired(required = false) @Qualifier("lmStudioChatModel") OpenAiChatModel lmStudio,
            @Autowired(required = false) AnthropicChatModel anthropic,
            @Autowired(required = false) GoogleGenAiChatModel googleGenAi,
            @Value("${datachat.openai.model:gpt-5-nano-2025-08-07}") String openAiModel,
            @Value("${datachat.anthropic.model:claude-sonnet-4-6}") String anthropicModel,
            @Value("${spring.ai.google.genai.chat.options.model:gemini-3.1-flash-lite-preview}") String googleModel,
            @Value("${datachat.lmstudio.model:local-model}") String lmStudioModel
        ) {
            // LM Studio accepts a CSV list (LMSTUDIO_MODEL=model-a,model-b) so the picker
            // can offer several local models. Each entry becomes a separate UI option; the
            // ChatOrchestrator swaps models per-call via .options() on the shared bean.
            List<String> lmStudioModels = Arrays.stream(lmStudioModel.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
            Map<String, ProviderEntry> m = new LinkedHashMap<>();
            m.put("google", new ProviderEntry(googleGenAi, List.of(googleModel)));
            m.put("openai", new ProviderEntry(openAi, List.of(openAiModel)));
            m.put("anthropic", new ProviderEntry(anthropic, List.of(anthropicModel)));
            m.put("lmstudio", new ProviderEntry(lmStudio, lmStudioModels));
            return m;
        }
    }
}
