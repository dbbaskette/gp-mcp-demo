package com.baskettecase.datachat.mcp;

import com.baskettecase.datachat.auth.PersonaSessionStore;
import org.springframework.stereotype.Component;

@Component
public class TokenForwardingInterceptor {
    private final PersonaSessionStore store;

    public TokenForwardingInterceptor(PersonaSessionStore store) { this.store = store; }

    public String resolveToken(String sessionId, String personaId) {
        return store.get(sessionId, personaId)
            .map(PersonaSessionStore.PersonaToken::accessToken)
            .orElseThrow(() -> new NotLoggedInException(personaId));
    }
}
