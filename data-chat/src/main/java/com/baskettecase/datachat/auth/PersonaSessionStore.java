package com.baskettecase.datachat.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PersonaSessionStore {

    private static final Logger log = LoggerFactory.getLogger(PersonaSessionStore.class);

    public record PersonaToken(String accessToken, Instant expiresAt) {
        boolean isExpired() { return !Instant.now().isBefore(expiresAt); }
    }

    private record Key(String sessionId, String personaId) {}

    private final ConcurrentHashMap<Key, PersonaToken> map = new ConcurrentHashMap<>();

    public void put(String sessionId, String personaId, PersonaToken token) {
        log.info("Storing token: sessionId={}, personaId={}, expiresAt={}", sessionId, personaId, token.expiresAt());
        map.put(new Key(sessionId, personaId), token);
    }

    public Optional<PersonaToken> get(String sessionId, String personaId) {
        PersonaToken t = map.get(new Key(sessionId, personaId));
        boolean found = t != null && !t.isExpired();
        log.debug("Lookup token: sessionId={}, personaId={}, found={}", sessionId, personaId, found);
        if (t == null || t.isExpired()) return Optional.empty();
        return Optional.of(t);
    }

    public void clear(String sessionId, String personaId) {
        map.remove(new Key(sessionId, personaId));
    }
}
