package com.baskettecase.gpchat.config;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
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
            ToolCallingManager toolCallingManager) {
        if (apiKey.isBlank() || "disabled".equalsIgnoreCase(apiKey)) {
            log.info("OpenAI API key not configured — skipping OpenAiChatModel bean");
            return null;
        }
        var client = OpenAIOkHttpClient.builder().apiKey(apiKey).build();
        return OpenAiChatModel.builder()
                .openAiClient(client)
                .options(OpenAiChatOptions.builder().model("gpt-4o").build())
                .toolCallingManager(toolCallingManager)
                .build();
    }

    @Bean
    AnthropicChatModel anthropicChatModel(
            @Value("${spring.ai.anthropic.api-key:}") String apiKey,
            ToolCallingManager toolCallingManager) {
        if (apiKey.isBlank() || "disabled".equalsIgnoreCase(apiKey)) {
            log.info("Anthropic API key not configured — skipping AnthropicChatModel bean");
            return null;
        }
        var client = AnthropicOkHttpClient.builder().apiKey(apiKey).build();
        return AnthropicChatModel.builder()
                .anthropicClient(client)
                .options(AnthropicChatOptions.builder().model("claude-sonnet-4-6").build())
                .toolCallingManager(toolCallingManager)
                .build();
    }
}
