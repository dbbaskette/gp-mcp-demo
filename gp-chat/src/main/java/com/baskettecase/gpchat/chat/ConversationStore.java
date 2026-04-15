package com.baskettecase.gpchat.chat;

import org.springframework.ai.chat.messages.Message;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ConversationStore {
    private record Key(String sessionId, String personaId) {}
    private final ConcurrentHashMap<Key, List<Message>> map = new ConcurrentHashMap<>();

    public List<Message> load(String sessionId, String personaId) {
        return map.computeIfAbsent(new Key(sessionId, personaId), k -> new ArrayList<>());
    }

    public void reset(String sessionId, String personaId) {
        map.remove(new Key(sessionId, personaId));
    }
}
