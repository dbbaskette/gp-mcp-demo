package com.baskettecase.datachat.chat;

import com.baskettecase.datachat.config.PersonaConfig;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers {@link ChatOrchestrator#normalizeMarkdownTables(String)}, which repairs GFM tables
 * that some models emit glued onto a single line.
 */
class MarkdownTableNormalizerTest {

    private final ChatOrchestrator orch = new ChatOrchestrator(
            Mockito.mock(com.baskettecase.datachat.llm.ModelRegistry.class),
            Mockito.mock(com.baskettecase.datachat.mcp.McpGateway.class),
            Mockito.mock(ConversationStore.class),
            Mockito.mock(AuditEventBus.class),
            new PersonaConfig(List.of(), List.of(), List.of()));

    @Test
    void splitsCollapsedTableIntoRows() {
        String collapsed = "| Schema | Table | Size | Total Size (incl. TOAST) | |--------|-------|------|---------------------------| | public | inventory | 493.3 MB | 493.4 MB |";
        String out = orch.normalizeMarkdownTables(collapsed);
        assertThat(out).isEqualTo(
                "| Schema | Table | Size | Total Size (incl. TOAST) |\n" +
                "| -------- | ------- | ------ | --------------------------- |\n" +
                "| public | inventory | 493.3 MB | 493.4 MB |");
    }

    @Test
    void leavesProperlyFormattedTableAlone() {
        String good = "| a | b |\n| --- | --- |\n| 1 | 2 |";
        assertThat(orch.normalizeMarkdownTables(good)).isEqualTo(good);
    }

    @Test
    void leavesNonTableProseAlone() {
        String prose = "This is a sentence with a | pipe in it, but no table.";
        assertThat(orch.normalizeMarkdownTables(prose)).isEqualTo(prose);
    }

    @Test
    void doesNotMangleSentenceContainingSeparatorSubstring() {
        // Line has a separator-looking substring but does NOT start and end with `|`, so we bail.
        String tricky = "Here is how a separator looks: |---|---|---| (for reference).";
        assertThat(orch.normalizeMarkdownTables(tricky)).isEqualTo(tricky);
    }

    @Test
    void handlesTitleBeforeTableOnSameLine() {
        // The exact shape Gemini 3.1 flash-lite emitted: a title, then the whole table
        // (header + separator + 10 data rows) all fused onto a single line.
        String in = "Largest Tables in Database | Table Name | Schema | Total Size | | :--- | :--- | :--- | | `inventory` | public | 493.4 MB | | `store_sales` | public | 400.8 MB |";
        String out = orch.normalizeMarkdownTables(in);
        assertThat(out).isEqualTo(
                "Largest Tables in Database\n\n" +
                "| Table Name | Schema | Total Size |\n" +
                "| :--- | :--- | :--- |\n" +
                "| `inventory` | public | 493.4 MB |\n" +
                "| `store_sales` | public | 400.8 MB |");
    }

    @Test
    void handlesTableFollowedByProseOnSameLine() {
        String in = "| a | b | |---|---| | 1 | 2 | And that's the answer.";
        String out = orch.normalizeMarkdownTables(in);
        assertThat(out).isEqualTo(
                "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n" +
                "And that's the answer.");
    }

    @Test
    void preservesSurroundingText() {
        String input = "Here are the results:\n\n| a | b | |---|---| | 1 | 2 |\n\nDone.";
        String out = orch.normalizeMarkdownTables(input);
        assertThat(out).isEqualTo(
                "Here are the results:\n\n" +
                "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n" +
                "Done.");
    }

    @Test
    void handlesNullAndEmpty() {
        assertThat(orch.normalizeMarkdownTables(null)).isNull();
        assertThat(orch.normalizeMarkdownTables("")).isEqualTo("");
        assertThat(orch.normalizeMarkdownTables("no pipes here")).isEqualTo("no pipes here");
    }
}
