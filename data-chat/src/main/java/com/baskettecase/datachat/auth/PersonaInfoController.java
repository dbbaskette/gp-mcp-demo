package com.baskettecase.datachat.auth;

import com.baskettecase.datachat.config.PersonaConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class PersonaInfoController {

    private final PersonaConfig cfg;
    private final PersonaSessionStore store;
    private final ObjectMapper om = new ObjectMapper();

    public PersonaInfoController(PersonaConfig cfg, PersonaSessionStore store) {
        this.cfg = cfg;
        this.store = store;
    }

    @GetMapping("/personas")
    public List<Map<String, Object>> list() {
        return cfg.personas().stream().map(p -> Map.<String, Object>of(
            "id", p.id(), "label", p.label(), "description", p.description()
        )).toList();
    }

    @GetMapping("/persona/{id}")
    public Map<String, Object> get(@PathVariable("id") String personaId,
                                   @RequestParam(value = "clientId", required = false) String clientId) {
        Map<String, Object> out = new HashMap<>();
        out.put("id", personaId);
        if (clientId == null || clientId.isBlank()) {
            out.put("loggedIn", false);
            return out;
        }
        var tok = store.get(clientId, personaId);
        out.put("loggedIn", tok.isPresent());
        tok.ifPresent(t -> {
            out.put("expiresAt", t.expiresAt().toString());
            out.put("claims", decodeClaims(t.accessToken()));
        });
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decodeClaims(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return Map.of();
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            return om.readValue(payload, Map.class);
        } catch (Exception e) { return Map.of("decode_error", e.getMessage()); }
    }
}
