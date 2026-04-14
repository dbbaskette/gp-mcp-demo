package com.baskettecase.gpchat.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PersonaSessionStore {

    public record PersonaToken(String accessToken, Instant expiresAt) {
        boolean isExpired() { return !Instant.now().isBefore(expiresAt); }
    }

    private record Key(String sessionId, String personaId) {}

    private final ConcurrentHashMap<Key, PersonaToken> map = new ConcurrentHashMap<>();

    public void put(String sessionId, String personaId, PersonaToken token) {
        map.put(new Key(sessionId, personaId), token);
    }

    public Optional<PersonaToken> get(String sessionId, String personaId) {
        PersonaToken t = map.get(new Key(sessionId, personaId));
        if (t == null || t.isExpired()) return Optional.empty();
        return Optional.of(t);
    }

    public void clear(String sessionId, String personaId) {
        map.remove(new Key(sessionId, personaId));
    }
}
