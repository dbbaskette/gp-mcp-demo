package com.baskettecase.datachat.config;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiModelsConfig {

    private static final Logger log = LoggerFactory.getLogger(AiModelsConfig.class);

    @Bean
    @ConditionalOnMissingBean
    ToolCallingManager toolCallingManager() {
        return ToolCallingManager.builder().build();
    }

    @Bean
    OpenAiChatModel openAiChatModel(
            @Value("${spring.ai.openai.api-key:}") String apiKey,
            @Value("${datachat.openai.model:gpt-5-nano-2025-08-07}") String model,
            @Value("${datachat.openai.temperature:0.7}") Double temperature,
            ToolCallingManager toolCallingManager) {
        if (apiKey.isBlank() || "disabled".equalsIgnoreCase(apiKey)) {
            log.info("OpenAI API key not configured — skipping OpenAiChatModel bean");
            return null;
        }
        log.info("Configuring OpenAI provider: model={}, temperature={}", model, temperature);
        var client = OpenAIOkHttpClient.builder().apiKey(apiKey).build();
        return OpenAiChatModel.builder()
                .openAiClient(client)
                .options(OpenAiChatOptions.builder()
                        .model(model)
                        .temperature(temperature)
                        .build())
                .toolCallingManager(toolCallingManager)
                .build();
    }

    @Bean
    OpenAiChatModel lmStudioChatModel(
            @Value("${datachat.lmstudio.base-url:}") String baseUrl,
            @Value("${datachat.lmstudio.api-key:lm-studio}") String apiKey,
            @Value("${datachat.lmstudio.model:local-model}") String modelsCsv,
            @Value("${datachat.lmstudio.temperature:0.7}") Double temperature,
            ToolCallingManager toolCallingManager) {
        if (baseUrl.isBlank() || "disabled".equalsIgnoreCase(baseUrl)) {
            log.info("LM Studio base URL not configured — skipping lmStudioChatModel bean");
            return null;
        }
        // First entry in the CSV becomes the bean's baked-in default; ChatOrchestrator
        // overrides it per-call via .options() when the user picks a different model.
        String defaultModel = modelsCsv.split(",")[0].trim();
        log.info("Configuring LM Studio provider: baseUrl={}, models={}, default={}, temperature={}",
                baseUrl, modelsCsv, defaultModel, temperature);
        var client = OpenAIOkHttpClient.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .build();
        return OpenAiChatModel.builder()
                .openAiClient(client)
                .options(OpenAiChatOptions.builder()
                        .model(defaultModel)
                        .temperature(temperature)
                        .build())
                .toolCallingManager(toolCallingManager)
                .build();
    }

    @Bean
    AnthropicChatModel anthropicChatModel(
            @Value("${spring.ai.anthropic.api-key:}") String apiKey,
            @Value("${datachat.anthropic.model:claude-sonnet-4-6}") String model,
            @Value("${datachat.anthropic.temperature:0.7}") Double temperature,
            ToolCallingManager toolCallingManager) {
        if (apiKey.isBlank() || "disabled".equalsIgnoreCase(apiKey)) {
            log.info("Anthropic API key not configured — skipping AnthropicChatModel bean");
            return null;
        }
        log.info("Configuring Anthropic provider: model={}, temperature={}", model, temperature);
        var client = AnthropicOkHttpClient.builder().apiKey(apiKey).build();
        return AnthropicChatModel.builder()
                .anthropicClient(client)
                .options(AnthropicChatOptions.builder()
                        .model(model)
                        .temperature(temperature)
                        .build())
                .toolCallingManager(toolCallingManager)
                .build();
    }
}
