package com.baskettecase.gpchat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "")
public record PersonaConfig(
    List<AuthProvider> authProviders,
    List<McpServer> mcpServers,
    List<Persona> personas
) {
    public record AuthProvider(
        String id,
        String issuerUri,
        String clientRegistrationMode,
        String clientId,
        String clientSecret,
        List<String> scopes
    ) {}

    public record McpServer(String id, String url, String label) {}

    public record Persona(
        String id,
        String label,
        String description,
        String authProvider,
        String mcpServer
    ) {}
}
