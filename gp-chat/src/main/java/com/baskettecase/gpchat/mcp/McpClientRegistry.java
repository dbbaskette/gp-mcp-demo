package com.baskettecase.gpchat.mcp;

import com.baskettecase.gpchat.config.PersonaConfig;
import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import org.springframework.stereotype.Component;

import java.net.http.HttpClient;
import java.time.Duration;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@Component
public class McpClientRegistry {

    private final PersonaConfig cfg;

    public McpClientRegistry(PersonaConfig cfg) { this.cfg = cfg; }

    public McpSyncClient openClient(String mcpServerId, String bearerToken) {
        var server = cfg.mcpServers().stream().filter(s -> s.id().equals(mcpServerId)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("unknown mcp server: " + mcpServerId));
        var transport = HttpClientSseClientTransport.builder(server.url())
            .customizeClient(cb -> cb.sslContext(trustAllSslContext()))
            .customizeRequest(req -> req.header("Authorization", "Bearer " + bearerToken))
            .build();
        var client = McpClient.sync(transport).requestTimeout(Duration.ofSeconds(30)).build();
        client.initialize();
        return client;
    }

    private static SSLContext trustAllSslContext() {
        try {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{new X509TrustManager() {
                public void checkClientTrusted(java.security.cert.X509Certificate[] c, String t) {}
                public void checkServerTrusted(java.security.cert.X509Certificate[] c, String t) {}
                public java.security.cert.X509Certificate[] getAcceptedIssuers() { return new java.security.cert.X509Certificate[0]; }
            }}, new java.security.SecureRandom());
            return ctx;
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
