package com.baskettecase.datachat.llm;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ModelsController {
    private final ModelRegistry registry;

    public ModelsController(ModelRegistry registry) { this.registry = registry; }

    @GetMapping("/models")
    public List<ModelRegistry.ProviderView> list() { return registry.list(); }
}
