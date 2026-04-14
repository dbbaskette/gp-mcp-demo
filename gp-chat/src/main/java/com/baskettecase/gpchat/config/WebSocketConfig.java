package com.baskettecase.gpchat.config;

import com.baskettecase.gpchat.chat.ChatWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler handler;

    public WebSocketConfig(ChatWebSocketHandler handler) { this.handler = handler; }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry r) {
        r.addHandler(handler, "/ws/chat")
            .setAllowedOrigins("*")
            .addInterceptors(new HandshakeInterceptor() {
                @Override
                public boolean beforeHandshake(ServerHttpRequest req, ServerHttpResponse res,
                                               WebSocketHandler wsh, Map<String, Object> attrs) {
                    if (req instanceof ServletServerHttpRequest s) {
                        attrs.put("HTTP.SESSION.ID", s.getServletRequest().getSession(true).getId());
                    }
                    return true;
                }

                @Override
                public void afterHandshake(ServerHttpRequest req, ServerHttpResponse res,
                                           WebSocketHandler wsh, Exception ex) {}
            });
    }
}
