package com.baskettecase.datachat;

import com.baskettecase.datachat.config.PersonaConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication(exclude = {
    org.springframework.ai.model.openai.autoconfigure.OpenAiChatAutoConfiguration.class,
    org.springframework.ai.model.openai.autoconfigure.OpenAiEmbeddingAutoConfiguration.class,
    org.springframework.ai.model.openai.autoconfigure.OpenAiImageAutoConfiguration.class,
    org.springframework.ai.model.openai.autoconfigure.OpenAiAudioSpeechAutoConfiguration.class,
    org.springframework.ai.model.openai.autoconfigure.OpenAiAudioTranscriptionAutoConfiguration.class,
    org.springframework.ai.model.openai.autoconfigure.OpenAiModerationAutoConfiguration.class,
    org.springframework.ai.model.anthropic.autoconfigure.AnthropicChatAutoConfiguration.class
})
@EnableConfigurationProperties(PersonaConfig.class)
public class DataChatApplication {
    public static void main(String[] args) { SpringApplication.run(DataChatApplication.class, args); }
}
