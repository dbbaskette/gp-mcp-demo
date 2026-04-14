package com.baskettecase.gpchat.auth;

import com.baskettecase.gpchat.config.PersonaConfig;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class FeauxAuthClient {

    private static final Logger log = LoggerFactory.getLogger(FeauxAuthClient.class);

    private final PersonaConfig cfg;
    private final RestClient http;
    private final Map<String, ClientCreds> clientCredsByProvider = new ConcurrentHashMap<>();
    private final Map<String, Pkce> pendingPkce = new ConcurrentHashMap<>();

    public record ClientCreds(String clientId, String clientSecret) {}
    public record Pkce(String codeVerifier, String codeChallenge, String personaId, String sessionId, String providerId) {}
    public record TokenResponse(@JsonProperty("access_token") String accessToken,
                                @JsonProperty("expires_in") Long expiresIn,
                                @JsonProperty("id_token") String idToken) {}
    private record RegisterResponse(@JsonProperty("client_id") String clientId,
                                    @JsonProperty("client_secret") String clientSecret) {}

    public FeauxAuthClient(PersonaConfig cfg, RestClient.Builder restClientBuilder) {
        this.cfg = cfg;
        this.http = restClientBuilder.build();
    }

    @PostConstruct
    void registerAll() {
        if (cfg.authProviders() == null) return;
        for (var p : cfg.authProviders()) {
            if ("static".equals(p.clientRegistrationMode())) {
                clientCredsByProvider.put(p.id(), new ClientCreds(p.clientId(), p.clientSecret()));
            } else {
                try {
                    var body = Map.of(
                        "client_name", "gp-chat",
                        "redirect_uris", List.of("https://localhost/chat/api/auth/callback"),
                        "grant_types", List.of("authorization_code", "refresh_token"),
                        "token_endpoint_auth_method", "client_secret_post",
                        "scope", String.join(" ", p.scopes())
                    );
                    var resp = http.post()
                        .uri(p.issuerUri() + "/oauth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(RegisterResponse.class);
                    clientCredsByProvider.put(p.id(), new ClientCreds(resp.clientId(), resp.clientSecret()));
                    log.info("Dynamically registered OAuth client for provider '{}'", p.id());
                } catch (Exception e) {
                    log.warn("Failed to register OAuth client for provider '{}': {}", p.id(), e.getMessage());
                }
            }
        }
    }

    public String buildAuthorizeUrl(String providerId, String personaId, String sessionId) {
        var provider = cfg.authProviders().stream().filter(a -> a.id().equals(providerId)).findFirst().orElseThrow();
        var creds = clientCredsByProvider.get(providerId);
        if (creds == null) throw new IllegalStateException("No client credentials for provider: " + providerId);
        String verifier = randomUrlSafe(64);
        String challenge = sha256Base64Url(verifier);
        String state = randomUrlSafe(32);
        pendingPkce.put(state, new Pkce(verifier, challenge, personaId, sessionId, providerId));
        return provider.issuerUri() + "/oauth/authorize"
            + "?response_type=code"
            + "&client_id=" + url(creds.clientId())
            + "&redirect_uri=" + url("https://localhost/chat/api/auth/callback")
            + "&scope=" + url(String.join(" ", provider.scopes()))
            + "&state=" + state
            + "&code_challenge=" + challenge
            + "&code_challenge_method=S256"
            + "&login_hint=" + url(personaId);
    }

    public Pkce consumePkce(String state) {
        return pendingPkce.remove(state);
    }

    public TokenResponse exchangeCode(String providerId, String code, String codeVerifier) {
        var provider = cfg.authProviders().stream().filter(a -> a.id().equals(providerId)).findFirst().orElseThrow();
        var creds = clientCredsByProvider.get(providerId);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", "https://localhost/chat/api/auth/callback");
        form.add("client_id", creds.clientId());
        form.add("client_secret", creds.clientSecret());
        form.add("code_verifier", codeVerifier);
        return http.post()
            .uri(provider.issuerUri() + "/oauth/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(TokenResponse.class);
    }

    public static String randomUrlSafe(int bytes) {
        byte[] buf = new byte[bytes];
        new SecureRandom().nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    private static String sha256Base64Url(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(d);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private static String url(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    public static Instant expiryFromExpiresIn(Long expiresIn) {
        return Instant.now().plusSeconds(expiresIn == null ? 3600 : expiresIn);
    }
}
