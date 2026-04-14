package com.baskettecase.gpchat.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PersonaConfigValidatorTest {

    private final PersonaConfigValidator validator = new PersonaConfigValidator();

    @Test
    void acceptsValidConfig() {
        var cfg = new PersonaConfig(
            List.of(new PersonaConfig.AuthProvider("feauxauth", "https://localhost", "dynamic", null, null, List.of("openid"))),
            List.of(new PersonaConfig.McpServer("gp-mcp", "https://localhost/mcp", "Greenplum MCP")),
            List.of(new PersonaConfig.Persona("viewer", "Viewer", "ro", "feauxauth", "gp-mcp"))
        );
        validator.validate(cfg);
    }

    @Test
    void rejectsDuplicatePersonaIds() {
        var cfg = new PersonaConfig(
            List.of(new PersonaConfig.AuthProvider("feauxauth", "https://localhost", "dynamic", null, null, List.of("openid"))),
            List.of(new PersonaConfig.McpServer("gp-mcp", "https://localhost/mcp", "Greenplum MCP")),
            List.of(
                new PersonaConfig.Persona("viewer", "A", "", "feauxauth", "gp-mcp"),
                new PersonaConfig.Persona("viewer", "B", "", "feauxauth", "gp-mcp")
            )
        );
        assertThatThrownBy(() -> validator.validate(cfg))
            .hasMessageContaining("duplicate persona id: viewer");
    }

    @Test
    void rejectsUnknownAuthProviderReference() {
        var cfg = new PersonaConfig(
            List.of(new PersonaConfig.AuthProvider("feauxauth", "https://localhost", "dynamic", null, null, List.of("openid"))),
            List.of(new PersonaConfig.McpServer("gp-mcp", "https://localhost/mcp", "Greenplum MCP")),
            List.of(new PersonaConfig.Persona("viewer", "V", "", "nope", "gp-mcp"))
        );
        assertThatThrownBy(() -> validator.validate(cfg))
            .hasMessageContaining("unknown authProvider 'nope' referenced by persona 'viewer'");
    }

    @Test
    void rejectsUnknownMcpServerReference() {
        var cfg = new PersonaConfig(
            List.of(new PersonaConfig.AuthProvider("feauxauth", "https://localhost", "dynamic", null, null, List.of("openid"))),
            List.of(new PersonaConfig.McpServer("gp-mcp", "https://localhost/mcp", "Greenplum MCP")),
            List.of(new PersonaConfig.Persona("viewer", "V", "", "feauxauth", "missing"))
        );
        assertThatThrownBy(() -> validator.validate(cfg))
            .hasMessageContaining("unknown mcpServer 'missing' referenced by persona 'viewer'");
    }

    @Test
    void rejectsMalformedIssuerUri() {
        var cfg = new PersonaConfig(
            List.of(new PersonaConfig.AuthProvider("feauxauth", "not a url", "dynamic", null, null, List.of("openid"))),
            List.of(new PersonaConfig.McpServer("gp-mcp", "https://localhost/mcp", "Greenplum MCP")),
            List.of(new PersonaConfig.Persona("viewer", "V", "", "feauxauth", "gp-mcp"))
        );
        assertThatThrownBy(() -> validator.validate(cfg))
            .hasMessageContaining("authProvider 'feauxauth' issuerUri is not a valid URL");
    }
}
