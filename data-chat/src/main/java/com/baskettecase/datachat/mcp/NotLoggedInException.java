package com.baskettecase.datachat.mcp;

public class NotLoggedInException extends RuntimeException {
    private final String personaId;

    public NotLoggedInException(String personaId) {
        super("not logged in: " + personaId);
        this.personaId = personaId;
    }

    public String personaId() { return personaId; }
}
