package com.baskettecase.datachat.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class PersonaConfigBootValidator implements CommandLineRunner {
    private final PersonaConfig cfg;
    private final PersonaConfigValidator validator;
    public PersonaConfigBootValidator(PersonaConfig cfg, PersonaConfigValidator validator) {
        this.cfg = cfg; this.validator = validator;
    }
    @Override public void run(String... args) { validator.validate(cfg); }
}
