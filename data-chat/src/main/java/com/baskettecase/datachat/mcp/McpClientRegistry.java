package com.baskettecase.datachat.mcp;

import com.baskettecase.datachat.config.PersonaConfig;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class McpClientRegistry {

    private static final Logger log = LoggerFactory.getLogger(McpClientRegistry.class);
    private final ObjectMapper om = new ObjectMapper();
    private final PersonaConfig cfg;
    private final HttpClient httpClient;
    private final AtomicInteger idSeq = new AtomicInteger(1);

    public McpClientRegistry(PersonaConfig cfg) {
        this.cfg = cfg;
        this.httpClient = HttpClient.newBuilder().sslContext(trustAllSslContext()).build();
    }

    public record McpSession(String serverUrl, String bearerToken, String sessionId) {}
    private record McpResponse(String body, String sessionId) {}

    public McpSession initialize(String mcpServerId, String bearerToken) {
        var server = cfg.mcpServers().stream().filter(s -> s.id().equals(mcpServerId)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("unknown mcp server: " + mcpServerId));

        var initReq = Map.of(
            "jsonrpc", "2.0",
            "id", idSeq.getAndIncrement(),
            "method", "initialize",
            "params", Map.of(
                "protocolVersion", "2024-11-05",
                "capabilities", Map.of(),
                "clientInfo", Map.of("name", "data-chat", "version", "1.0")
            )
        );

        var resp = post(server.serverUrl(), bearerToken, null, initReq, true);
        log.info("MCP initialized: server={}, sessionId={}", mcpServerId, resp.sessionId());

        // Send initialized notification (fire and forget)
        Map<String, Object> notification = Map.of("jsonrpc", "2.0", "method", "notifications/initialized");
        post(server.serverUrl(), bearerToken, resp.sessionId(), notification, false);

        return new McpSession(server.serverUrl(), bearerToken, resp.sessionId());
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listTools(McpSession session) {
        var body = rpc(session, "tools/list", Map.of());
        var result = (Map<String, Object>) body.get("result");
        return result != null ? (List<Map<String, Object>>) result.get("tools") : List.of();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> callTool(McpSession session, String name, Map<String, Object> args) {
        var body = rpc(session, "tools/call", Map.of("name", name, "arguments", args));
        var result = (Map<String, Object>) body.get("result");
        if (result != null) return result;
        var error = (Map<String, Object>) body.get("error");
        if (error != null) return Map.of("isError", true, "content", List.of(Map.of("type", "text", "text", error.toString())));
        return Map.of("isError", true, "content", List.of(Map.of("type", "text", "text", "Unknown MCP error")));
    }

    private Map<String, Object> rpc(McpSession session, String method, Map<String, Object> params) {
        var req = Map.of("jsonrpc", "2.0", "id", idSeq.getAndIncrement(), "method", method, "params", params);
        var resp = post(session.serverUrl(), session.bearerToken(), session.sessionId(), req, true);
        try {
            return om.readValue(resp.body(), new TypeReference<>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse MCP response: " + e.getMessage() + " body=" + resp.body(), e);
        }
    }

    private McpResponse post(String url, String token, String sessionId, Map<String, Object> body, boolean expectBody) {
        try {
            var reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json, text/event-stream")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body)));
            if (sessionId != null) {
                reqBuilder.header("Mcp-Session-Id", sessionId);
            }
            log.debug("MCP POST {} method={}", url, body.get("method"));

            var resp = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());
            var ct = resp.headers().firstValue("content-type").orElse("");
            var mcpSessionId = resp.headers().firstValue("mcp-session-id").orElse(sessionId);
            log.debug("MCP response: status={}, content-type={}", resp.statusCode(), ct);

            if (resp.statusCode() >= 400) {
                String err = new String(resp.body().readAllBytes());
                throw new RuntimeException("MCP HTTP " + resp.statusCode() + ": " + err);
            }

            if (!expectBody || resp.statusCode() == 202) {
                try { resp.body().close(); } catch (Exception ignored) {}
                return new McpResponse("{}", mcpSessionId);
            }

            String responseBody;
            if (ct.contains("text/event-stream")) {
                responseBody = readSseResponse(resp.body());
            } else {
                responseBody = new String(resp.body().readAllBytes());
            }
            log.debug("MCP body: {}", responseBody.substring(0, Math.min(responseBody.length(), 300)));
            return new McpResponse(responseBody, mcpSessionId);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("MCP request failed: " + e.getMessage(), e);
        }
    }

    private String readSseResponse(java.io.InputStream is) throws Exception {
        var reader = new BufferedReader(new InputStreamReader(is));
        StringBuilder data = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.startsWith("data:")) {
                String payload = line.substring(5).trim();
                if (!payload.isEmpty()) {
                    data.append(payload);
                }
            }
            if (line.isEmpty() && data.length() > 0) {
                String json = data.toString();
                if (json.contains("\"result\"") || json.contains("\"error\"")) {
                    reader.close();
                    return json;
                }
            }
        }
        reader.close();
        return data.length() > 0 ? data.toString() : "{}";
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
