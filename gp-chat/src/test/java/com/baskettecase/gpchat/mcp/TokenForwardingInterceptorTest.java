package com.baskettecase.gpchat.mcp;

import com.baskettecase.gpchat.auth.PersonaSessionStore;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenForwardingInterceptorTest {

    @Test
    void readsTokenForActivePersona() {
        var store = new PersonaSessionStore();
        store.put("s1", "analyst", new PersonaSessionStore.PersonaToken("jwt-ANALYST", Instant.now().plusSeconds(60)));
        var interceptor = new TokenForwardingInterceptor(store);
        assertThat(interceptor.resolveToken("s1", "analyst")).isEqualTo("jwt-ANALYST");
    }

    @Test
    void throwsWhenNotLoggedIn() {
        var interceptor = new TokenForwardingInterceptor(new PersonaSessionStore());
        assertThatThrownBy(() -> interceptor.resolveToken("s1", "viewer"))
            .isInstanceOf(NotLoggedInException.class)
            .hasMessageContaining("viewer");
    }
}
