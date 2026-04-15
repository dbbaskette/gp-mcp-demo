package com.baskettecase.gpchat.auth;

import com.baskettecase.gpchat.config.PersonaConfig;
import com.baskettecase.gpchat.mcp.McpGateway;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PersonaLoginController {

    private static final Logger log = LoggerFactory.getLogger(PersonaLoginController.class);

    private final PersonaConfig cfg;
    private final FeauxAuthClient client;
    private final PersonaSessionStore store;
    private final McpGateway mcpGateway;

    public PersonaLoginController(PersonaConfig cfg, FeauxAuthClient client, PersonaSessionStore store, McpGateway mcpGateway) {
        this.cfg = cfg;
        this.client = client;
        this.store = store;
        this.mcpGateway = mcpGateway;
    }

    @GetMapping("/persona/{id}/login")
    public void login(@PathVariable("id") String personaId,
                      @RequestParam("clientId") String clientId,
                      HttpServletResponse res) throws IOException {
        cfg.personas().stream().filter(p -> p.id().equals(personaId)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("unknown persona: " + personaId));
        var persona = cfg.personas().stream().filter(p -> p.id().equals(personaId)).findFirst().orElseThrow();
        String url = client.buildAuthorizeUrl(persona.authProvider(), personaId, clientId);
        res.sendRedirect(url);
    }

    @GetMapping("/auth/callback")
    public ResponseEntity<String> callback(@RequestParam("code") String code,
                                           @RequestParam("state") String state) {
        var pkce = client.consumePkce(state);
        if (pkce == null) return ResponseEntity.badRequest().body("unknown or expired state");
        var token = client.exchangeCode(pkce.providerId(), code, pkce.codeVerifier());

        // Store the OAuth token
        String clientId = pkce.sessionId();
        String personaId = pkce.personaId();
        store.put(clientId, personaId,
            new PersonaSessionStore.PersonaToken(token.accessToken(), FeauxAuthClient.expiryFromExpiresIn(token.expiresIn())));

        // Verify MCP connectivity with this persona's token
        try {
            var tools = mcpGateway.verifyConnection(clientId, personaId);
            log.info("Persona '{}' authenticated, MCP verified ({} tools)", personaId, tools.size());
        } catch (Exception e) {
            log.warn("Persona '{}' authenticated but MCP verification failed: {}", personaId, e.getMessage());
        }

        String html = """
            <!doctype html><html><body><script>
              try { window.opener && window.opener.postMessage({type:'persona-login',personaId:'%s'}, '*'); } catch(e){}
              window.close();
            </script>Logged in as %s. You can close this tab.</body></html>
            """.formatted(personaId, personaId);
        return ResponseEntity.ok().header("Content-Type", "text/html").body(html);
    }

    @PostMapping("/persona/{id}/logout")
    public ResponseEntity<Map<String, String>> logout(@PathVariable("id") String personaId,
                                                      @RequestParam("clientId") String clientId) {
        store.clear(clientId, personaId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
