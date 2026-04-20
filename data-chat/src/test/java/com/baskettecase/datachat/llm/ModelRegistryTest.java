package com.baskettecase.datachat.llm;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class ModelRegistryTest {

    @Test
    void listsOnlyProvidersWithModels() {
        ChatModel openai = mock(ChatModel.class);
        var registry = new ModelRegistry(Map.of(
            "openai",    new ModelRegistry.ProviderEntry(openai, List.of("gpt-4o-mini", "gpt-4o")),
            "anthropic", new ModelRegistry.ProviderEntry(null, List.of())
        ));
        assertThat(registry.list()).extracting(ModelRegistry.ProviderView::id).containsExactly("openai");
        assertThat(registry.list().get(0).models()).containsExactly("gpt-4o-mini", "gpt-4o");
    }

    @Test
    void resolveReturnsModelForValidPair() {
        ChatModel openai = mock(ChatModel.class);
        var registry = new ModelRegistry(Map.of(
            "openai", new ModelRegistry.ProviderEntry(openai, List.of("gpt-4o-mini"))
        ));
        assertThat(registry.resolve("openai", "gpt-4o-mini")).isEqualTo(openai);
    }

    @Test
    void resolveThrowsForMissingProvider() {
        var registry = new ModelRegistry(Map.of());
        assertThatThrownBy(() -> registry.resolve("nope", "x"))
            .hasMessageContaining("unknown provider 'nope'");
    }
}
