package com.baskettecase.datachat.config;

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
        String internalUri,
        String clientRegistrationMode,
        String clientId,
        String clientSecret,
        List<String> scopes
    ) {
        /** URL for server-to-server calls (registration, token exchange). Falls back to issuerUri. */
        public String serverUri() { return internalUri != null ? internalUri : issuerUri; }
    }

    public record McpServer(String id, String url, String internalUrl, String label) {
        /** URL for server-to-server calls. Falls back to url. */
        public String serverUrl() { return internalUrl != null ? internalUrl : url; }
    }

    public record Persona(
        String id,
        String label,
        String description,
        String authProvider,
        String mcpServer,
        String systemPrompt,
        List<String> allowedTools
    ) {
        /** Safe accessor: null → empty list (which tasks 7/8 interpret as "no filter, all tools allowed"). */
        public List<String> allowedToolsOrEmpty() {
            return allowedTools == null ? List.of() : allowedTools;
        }

        /** Safe accessor: null/blank → fallback. */
        public String systemPromptOr(String fallback) {
            return (systemPrompt == null || systemPrompt.isBlank()) ? fallback : systemPrompt;
        }
    }
}
