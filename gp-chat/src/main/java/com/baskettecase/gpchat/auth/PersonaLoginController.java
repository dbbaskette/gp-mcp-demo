package com.baskettecase.gpchat.auth;

import com.baskettecase.gpchat.config.PersonaConfig;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PersonaLoginController {

    private final PersonaConfig cfg;
    private final FeauxAuthClient client;
    private final PersonaSessionStore store;

    public PersonaLoginController(PersonaConfig cfg, FeauxAuthClient client, PersonaSessionStore store) {
        this.cfg = cfg;
        this.client = client;
        this.store = store;
    }

    @GetMapping("/persona/{id}/login")
    public void login(@PathVariable("id") String personaId, HttpServletRequest req, HttpServletResponse res) throws IOException {
        cfg.personas().stream().filter(p -> p.id().equals(personaId)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("unknown persona: " + personaId));
        var persona = cfg.personas().stream().filter(p -> p.id().equals(personaId)).findFirst().orElseThrow();
        String sessionId = req.getSession(true).getId();
        String url = client.buildAuthorizeUrl(persona.authProvider(), personaId, sessionId);
        res.sendRedirect(url);
    }

    @GetMapping("/auth/callback")
    public ResponseEntity<String> callback(@RequestParam("code") String code,
                                           @RequestParam("state") String state,
                                           HttpServletRequest req) {
        var pkce = client.consumePkce(state);
        if (pkce == null) return ResponseEntity.badRequest().body("unknown or expired state");
        var token = client.exchangeCode(pkce.providerId(), code, pkce.codeVerifier());
        String sessionId = req.getSession(true).getId();
        store.put(sessionId, pkce.personaId(),
            new PersonaSessionStore.PersonaToken(token.accessToken(), FeauxAuthClient.expiryFromExpiresIn(token.expiresIn())));
        String html = """
            <!doctype html><html><body><script>
              try { window.opener && window.opener.postMessage({type:'persona-login',personaId:'%s'}, '*'); } catch(e){}
              window.close();
            </script>Logged in as %s. You can close this tab.</body></html>
            """.formatted(pkce.personaId(), pkce.personaId());
        return ResponseEntity.ok().header("Content-Type", "text/html").body(html);
    }

    @PostMapping("/persona/{id}/logout")
    public ResponseEntity<Map<String, String>> logout(@PathVariable("id") String personaId, HttpServletRequest req) {
        store.clear(req.getSession(true).getId(), personaId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
