# Varied Persona Access — Design

**Status**: approved, pending implementation plan
**Date**: 2026-04-21
**Owner**: Data-Chat demo

## Problem

The `viewer`, `analyst`, and `dba` personas currently produce near-identical
answers in the side-by-side compare UI. Only a small Greenplum GRANT difference
separates them, and the chat app never naturally tries the writes or DDL that
would reveal that difference. The demo fails to show why role-aware MCP access
matters.

## Goal

Make each persona visibly different along three axes — **scope**, **action
type**, and **data visibility** — so that six curated prompts in compare mode
produce three clearly distinct panels each. The demo should hit all four of the
MCP server's control surfaces (object GRANTs, policy.yaml, masking.yaml,
per-persona tool subset) in under 60 seconds of walkthrough.

## Non-goals

- Real Keycloak or mTLS — FeauxAuth stays in place.
- Hard MCP-level tool gating. Tool scoping for personas is enforced in the
  data-chat orchestrator via the tool list sent to the LLM ("soft" gating). The
  authoritative enforcement remains at the DB layer (policy.yaml + GRANTs).
- Extending TPCDS schema. Use existing columns; do not add new sensitive
  columns.

## Persona Matrix

| Axis | Viewer | Analyst | DBA |
|---|---|---|---|
| **JWT role → DB user** | `readonly` → `readonly_user` | `analyst` → `analyst_user` | `admin` → `gpadmin` |
| **Object GRANTs** | SELECT on `customer`, `store_sales`, `item`, `date_dim` | SELECT on all `public.*` tables | superuser (+ `pg_catalog`, `gp_toolkit`) |
| **policy.yaml** | `readonly: true`; allowed: `SELECT`, `EXPLAIN`, `SHOW` only | `readonly: true`; denied: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER` | `readonly: false`; denied: `DROP DATABASE`, `TRUNCATE` (safety net) |
| **masking.yaml** | Full redact: `c_email_address`, `c_first_name`, `c_last_name`, `c_birth_year`, `c_login`. Partial on `c_customer_id` (last 4). | Partial on `c_email_address` (domain visible), `c_birth_year` shown as decade bucket, `c_customer_id` clear. | Disabled — clear values. |
| **LLM tool subset** (soft) | Discovery tools + `execute_query`, `explain_query` | Above + `get_table_madlib_analytics`, `gpmlbot_list_models`, `gpmlbot_train`, `gpmlbot_predict`, `find_largest_*` | Above + diagnostics: `check_table_bloat`, `check_table_skew`, `check_stats_freshness`, `check_long_running_queries`, `check_disk_space`, `cancel_query` |
| **System-prompt voice** | "Support rep looking up individual customers." | "Business analyst running KPIs and ML experiments." | "Greenplum DBA running ops, capacity, and health checks." |

### Why date_dim is in the viewer scope

Q3 of the demo arc ("top-selling category in 2001") needs the viewer to at
least be able to say "I can run it for the store channel" and produce a time-
filtered answer. Dropping `date_dim` would leave the viewer with no useful
fallback.

## Control-layer mapping

Four layers cooperate. Each demo query exercises at least one.

1. **Greenplum GRANTs** (object scope) — viewer denied on `web_sales`.
2. **policy.yaml** (statement type) — viewer/analyst blocked from `UPDATE`.
3. **masking.yaml** (column values) — viewer sees `***REDACTED***`, analyst
   sees domain-only, DBA sees clear.
4. **LLM tool subset** (what the agent will even attempt) — viewer won't try
   `check_table_bloat` because it doesn't know the tool exists.

Hard enforcement is layers 1-3. Layer 4 is presentation — the LLM is told a
subset of tool names, so it will not call the others, but if it did, the DB
would still block.

## Demo arc — six prompts, one per axis

Each prompt runs in all three panes simultaneously via compare mode.

### Q1. Masking reveal (visibility)
> "Show me the first 5 customers with their email, customer ID, and birth year."

- **Viewer**: redacted rows (`***REDACTED***`, ID last-4).
- **Analyst**: partial (`b***@yahoo.com`, `1970s`).
- **DBA**: clear (`bob.smith@yahoo.com`, `1972`).

### Q2. Scope reveal (object GRANT)
> "How many orders are in the `web_sales` table?"

- **Viewer**: `permission denied for table web_sales`; explains its narrow slice.
- **Analyst / DBA**: count returned.

### Q3. Cross-table reveal (scope × join)
> "Which item category generated the most revenue in 2001 through the web channel?"

- **Viewer**: can't — offers store-channel fallback using `store_sales + item + date_dim`.
- **Analyst / DBA**: ranked category list.

### Q4. Ops reveal (diagnostic tool subset)
> "Is the `store_sales` table healthy? Any bloat, skew, or stale stats I should know about?"

- **Viewer / Analyst**: no diagnostics tools in subset — defer to DBA.
- **DBA**: runs `check_table_bloat`, `check_table_skew`, `check_stats_freshness`; returns a health card.

### Q5. ML reveal (analytics tool subset)
> "Train a quick classifier to predict which customers are likely to make a purchase in the store channel — use `customer` and `store_sales`."

- **Viewer**: no ML tools; declines.
- **Analyst**: profiles with MADlib, trains via `gpmlbot_train`, returns leaderboard.
- **DBA**: same tools available; typically sanity-checks cluster first.

### Q6. Policy reveal (action type)
> "Update customer `AAAAAAAABAAAAAAA`'s email to `new.email@example.com`."

- **Viewer / Analyst**: policy.yaml rejects — "statement type UPDATE not allowed."
- **DBA**: executes and reports `UPDATE 1`.

Kept as a live UPDATE (approved). If the stage demo turns mutation-averse, a
one-line swap to `CREATE VIEW top_customers_by_revenue AS …` covers the same
axis with a CREATE instead of an UPDATE.

## Files to change

### 1. `mcp-docker-config.yaml` + `docker-compose.yml`
Mount `policy.yaml` and `masking.yaml` into the `mcp` container alongside
`config.yaml`. The compose command for `mcp` currently passes
`--readonly=false` on the CLI; drop that flag so policy.yaml (which sets
`readonly` per role) is the single source of truth. Verify during
implementation that policy.yaml's role-scoped `readonly` wins over any
server-wide default.

### 2. NEW `policy.yaml` (mounted into the MCP container)
```yaml
gpdb:
  all:
    readonly: true
    allowed: []
    denied: []
  readonly:
    readonly: true
    allowed: ["SELECT", "EXPLAIN", "SHOW"]
    denied: []
  analyst:
    readonly: true
    allowed: []
    denied: ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER"]
  admin:
    readonly: false
    allowed: []
    denied: ["DROP DATABASE", "TRUNCATE"]
```

### 3. NEW `masking.yaml`
```yaml
masking:
  enabled: true
  roles:
    readonly:
      enabled: true
      columns:
        - { schema: public, table: customer, column: c_email_address,  method: full }
        - { schema: public, table: customer, column: c_first_name,     method: full }
        - { schema: public, table: customer, column: c_last_name,      method: full }
        - { schema: public, table: customer, column: c_birth_year,     method: full }
        - { schema: public, table: customer, column: c_login,          method: full }
        - { schema: public, table: customer, column: c_customer_id,    method: partial, params: { show_last: 4 } }
    analyst:
      enabled: true
      patterns:
        - { pattern: "*email*",       method: partial, params: { show_last_domain: true } }
        - { pattern: "c_birth_year",  method: bucket,  params: { bucket: decade } }
    admin:
      enabled: false
```
(The exact `method` names — `partial`, `bucket`, `show_last_domain` — must be
verified against the MCP server's supported masking methods during the
implementation plan; substitute the nearest supported equivalent if one of
these isn't available.)

### 4. `docker/setup-demo-users.sh`
Expand `readonly_user` GRANTs:
```sql
GRANT SELECT ON customer, store_sales, item, date_dim TO readonly_user;
```
Current script grants only the first three.

### 5. `data-chat/config/personas.yaml`
Add per-persona `systemPrompt` and `allowedTools` fields. Example:
```yaml
personas:
  - id: viewer
    label: "Read-only Viewer"
    systemPrompt: |
      You are a customer-support agent with read-only access to a narrow slice
      of TPCDS. You can look up individual customers and recent store-channel
      activity. You cannot query web sales, run diagnostics, or train models.
      When blocked, explain in one sentence why and suggest which persona can.
    allowedTools:
      - list_schemas
      - list_tables
      - describe_tables
      - execute_query
      - explain_query
```
Analyst and DBA lists as in the matrix above.

### 6. data-chat orchestrator (`ChatOrchestrator.java` or adjacent)
When building the MCP tool list handed to the LLM for a persona, filter the
advertised tools to the persona's `allowedTools`. Do not pre-filter MCP
responses — the server still serves any tool the DB user has rights to. This
is purely a presentation filter for the LLM.

## Open questions for the implementation plan

- Does the MCP server version in `Tanzu-GP-MCP-Server/gp-mcp-server-linux-arm64`
  support `policy.yaml` and `masking.yaml` in the v13 form shown in the PDF?
  Verify by mounting a minimal version and hitting the server with each
  persona's JWT.
- Masking methods: confirm which of `full`, `partial`, `bucket`,
  `show_last_domain` are actually implemented. Fall back to pattern-based
  masking if `bucket` isn't supported (e.g., drop `c_birth_year` shaping for
  analyst and accept "clear or redacted" as the binary).
- `default_database_username` in `mcp-docker-config.yaml` currently falls
  through to `readonly_user`. That's safe — keep it.

## Success criteria

Running the demo in compare mode with all three personas selected:

1. Q1 returns three visually distinct rows for the same customer.
2. Q2 shows viewer failing with a permission-denied message, others succeeding.
3. Q4 shows only the DBA producing a health card; others explicitly defer.
4. Q6 shows viewer/analyst blocked by policy, DBA succeeding.
5. Every failure mode is a *clear, short* explanation ("policy blocks UPDATE
   for readonly roles"), not a stack trace.
