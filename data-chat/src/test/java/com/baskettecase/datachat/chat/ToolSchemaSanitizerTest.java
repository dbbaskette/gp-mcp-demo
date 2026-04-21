package com.baskettecase.datachat.chat;

import com.baskettecase.datachat.config.PersonaConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Locks in schema fixups applied before handing MCP tool declarations to the LLM. Each case
 * corresponds to a real provider-level rejection we've hit.
 */
class ToolSchemaSanitizerTest {

    private final ObjectMapper om = new ObjectMapper();
    private final ChatOrchestrator orch = new ChatOrchestrator(
            Mockito.mock(com.baskettecase.datachat.llm.ModelRegistry.class),
            Mockito.mock(com.baskettecase.datachat.mcp.McpGateway.class),
            Mockito.mock(ConversationStore.class),
            Mockito.mock(AuditEventBus.class),
            new PersonaConfig(List.of(), List.of(), List.of()));

    @Test
    void injectsEmptyPropertiesOnBareObject() throws Exception {
        String fixed = orch.sanitizeToolSchema("{\"type\":\"object\"}");
        var node = om.readTree(fixed);
        assertThat(node.has("properties")).isTrue();
        assertThat(node.get("properties").isObject()).isTrue();
        assertThat(node.get("properties").size()).isZero();
    }

    @Test
    void injectsItemsOnBareArrayProperty() throws Exception {
        String in = "{\"type\":\"object\",\"properties\":{\"schemas\":{\"type\":\"array\"}}}";
        var node = om.readTree(orch.sanitizeToolSchema(in));
        var items = node.get("properties").get("schemas").get("items");
        assertThat(items).isNotNull();
        assertThat(items.get("type").asText()).isEqualTo("string");
    }

    @Test
    void dropsEmptyStringFromEnum() throws Exception {
        String in = "{\"type\":\"object\",\"properties\":{\"k\":{\"type\":\"string\",\"enum\":[\"\",\"a\",\"b\"]}}}";
        var node = om.readTree(orch.sanitizeToolSchema(in));
        var en = node.get("properties").get("k").get("enum");
        assertThat(en.size()).isEqualTo(2);
        assertThat(en.get(0).asText()).isEqualTo("a");
        assertThat(en.get(1).asText()).isEqualTo("b");
    }

    @Test
    void removesEnumEntirelyIfOnlyEmptyStrings() throws Exception {
        String in = "{\"type\":\"object\",\"properties\":{\"k\":{\"type\":\"string\",\"enum\":[\"\"]}}}";
        var node = om.readTree(orch.sanitizeToolSchema(in));
        assertThat(node.get("properties").get("k").has("enum")).isFalse();
    }

    @Test
    void recursesIntoNestedItemsAndAnyOf() throws Exception {
        String in = """
            {"type":"object","properties":{
              "nested":{"type":"array","items":{"type":"array"}},
              "polymorphic":{"anyOf":[{"type":"object"},{"type":"array"}]}
            }}
            """;
        var node = om.readTree(orch.sanitizeToolSchema(in));
        // Inner array gets its own items injected
        assertThat(node.get("properties").get("nested").get("items").get("items").get("type").asText())
                .isEqualTo("string");
        var anyOf = node.get("properties").get("polymorphic").get("anyOf");
        assertThat(anyOf.get(0).get("properties").isObject()).isTrue();
        assertThat(anyOf.get(1).get("items").get("type").asText()).isEqualTo("string");
    }

    @Test
    void leavesWellFormedSchemaUntouched() throws Exception {
        String in = "{\"type\":\"object\",\"properties\":{\"k\":{\"type\":\"array\",\"items\":{\"type\":\"integer\"}}}}";
        var node = om.readTree(orch.sanitizeToolSchema(in));
        assertThat(node.get("properties").get("k").get("items").get("type").asText()).isEqualTo("integer");
    }

    @Test
    void malformedJsonIsReturnedUnchanged() {
        String bad = "{not valid json";
        assertThat(orch.sanitizeToolSchema(bad)).isEqualTo(bad);
    }
}
