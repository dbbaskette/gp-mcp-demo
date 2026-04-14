package com.baskettecase.gpchat;

import com.baskettecase.gpchat.config.PersonaConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(PersonaConfig.class)
public class GpChatApplication {
    public static void main(String[] args) { SpringApplication.run(GpChatApplication.class, args); }
}
