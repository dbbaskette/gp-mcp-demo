package com.baskettecase.datachat.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class PersonaSessionStoreTest {

    @Test
    void storesAndRetrievesTokenByPersona() {
        var store = new PersonaSessionStore();
        var token = new PersonaSessionStore.PersonaToken("jwt-abc", Instant.now().plusSeconds(3600));
        store.put("session-1", "analyst", token);

        assertThat(store.get("session-1", "analyst")).contains(token);
        assertThat(store.get("session-1", "viewer")).isEmpty();
        assertThat(store.get("other-session", "analyst")).isEmpty();
    }

    @Test
    void clearsAll() {
        var store = new PersonaSessionStore();
        store.put("s", "a", new PersonaSessionStore.PersonaToken("t", Instant.now().plusSeconds(60)));
        store.put("s", "b", new PersonaSessionStore.PersonaToken("t2", Instant.now().plusSeconds(60)));
        store.clear("s", "a");

        assertThat(store.get("s", "a")).isEmpty();
        assertThat(store.get("s", "b")).isPresent();
    }

    @Test
    void expiredTokensAreNotReturned() {
        var store = new PersonaSessionStore();
        store.put("s", "a", new PersonaSessionStore.PersonaToken("t", Instant.now().minusSeconds(1)));
        assertThat(store.get("s", "a")).isEmpty();
    }
}
