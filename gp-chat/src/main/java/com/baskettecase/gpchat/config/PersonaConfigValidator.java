package com.baskettecase.gpchat.config;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class PersonaConfigValidator {

    public void validate(PersonaConfig cfg) {
        if (cfg == null) throw new IllegalStateException("personas config is null");

        Set<String> providerIds = new HashSet<>();
        for (var p : nullSafe(cfg.authProviders())) {
            if (!providerIds.add(p.id())) throw new IllegalStateException("duplicate authProvider id: " + p.id());
            try { URI.create(p.issuerUri()).toURL(); }
            catch (Exception e) { throw new IllegalStateException("authProvider '" + p.id() + "' issuerUri is not a valid URL: " + p.issuerUri()); }
            if (!"dynamic".equals(p.clientRegistrationMode()) && !"static".equals(p.clientRegistrationMode()))
                throw new IllegalStateException("authProvider '" + p.id() + "' clientRegistrationMode must be 'dynamic' or 'static'");
            if ("static".equals(p.clientRegistrationMode()) && (p.clientId() == null || p.clientSecret() == null))
                throw new IllegalStateException("authProvider '" + p.id() + "' static mode requires clientId and clientSecret");
        }

        Set<String> serverIds = new HashSet<>();
        for (var s : nullSafe(cfg.mcpServers())) {
            if (!serverIds.add(s.id())) throw new IllegalStateException("duplicate mcpServer id: " + s.id());
            try { URI.create(s.url()).toURL(); }
            catch (Exception e) { throw new IllegalStateException("mcpServer '" + s.id() + "' url is not a valid URL: " + s.url()); }
        }

        Set<String> personaIds = new HashSet<>();
        for (var p : nullSafe(cfg.personas())) {
            if (!personaIds.add(p.id())) throw new IllegalStateException("duplicate persona id: " + p.id());
            if (!providerIds.contains(p.authProvider()))
                throw new IllegalStateException("unknown authProvider '" + p.authProvider() + "' referenced by persona '" + p.id() + "'");
            if (!serverIds.contains(p.mcpServer()))
                throw new IllegalStateException("unknown mcpServer '" + p.mcpServer() + "' referenced by persona '" + p.id() + "'");
        }
    }

    private static <T> List<T> nullSafe(List<T> in) {
        return in == null ? List.of() : in;
    }
}
