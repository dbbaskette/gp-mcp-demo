# Varied Persona Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the GA 1.0.0 MCP server and data-chat so that the three personas (viewer / analyst / dba) produce visibly different answers across all four control axes — object GRANTs, statement-type policy, column masking, and per-persona tool subset. Demo execution is done by `tanzu-video-pipeline`; this plan ends at "the stack is ready to record."

**Architecture:**
1. Mount `policy.yaml` + `masking.yaml` into the `mcp` container; reference them from `mcp-docker-config.yaml` via `service.policy_path` / `service.masking_path`. GA binary already loaded.
2. Expand Greenplum GRANTs for `readonly_user` so the viewer scope matches the spec, and realign `setup-demo-users.sh` to `@email.com` addresses.
3. Extend the data-chat `personas.yaml` schema with per-persona `systemPrompt` and `allowedTools`. Wire them through `PersonaConfig` → `ChatOrchestrator` so (a) every turn prepends a persona-specific system message and (b) the MCP tool list handed to the LLM is filtered to the persona's allowlist. Server-side enforcement remains at the DB/policy layer.

**Tech Stack:** Go MCP server (ships as binary, configured via YAML), Greenplum 7 (GRANTs / views), Spring Boot + Spring AI `ChatClient` / `ToolCallback` in `ChatOrchestrator.java`, Zustand/React frontend (no change this plan).

---

## File Structure

**New files:**
- `policy.yaml` (repo root — mounted into mcp container as `/app/policy.yaml`)
- `masking.yaml` (repo root — mounted into mcp container as `/app/masking.yaml`)

**Modified files:**
- `mcp-docker-config.yaml` — add `service.policy_path` + `service.masking_path`
- `docker-compose.yml` — mount the two new files into the mcp service
- `docker/setup-demo-users.sh` — add `date_dim` to readonly grants, switch seed user emails to `@email.com`, drop `@feauxauth.local` legacy seeds
- `data-chat/config/personas.yaml` — add `systemPrompt` + `allowedTools` per persona
- `data-chat/src/main/java/com/baskettecase/datachat/config/PersonaConfig.java` — add the two fields to the `Persona` record
- `data-chat/src/main/java/com/baskettecase/datachat/chat/ChatOrchestrator.java` — use persona-scoped system prompt; filter `callbacks` list by `allowedTools`

---

## Task 1: Smoke-test the GA binary's policy + masking config shape

**Purpose:** De-risk the entire plan. Before writing the real `policy.yaml` / `masking.yaml`, confirm the exact YAML shape the GA binary accepts. The server's auto-generated default (`/root/.gp_mcp/policy.yaml`) shows the top-level `gpdb:` layout; the binary's struct tags confirm masking field names but not the enclosing file layout. If the files are loaded and the startup log shows "Loaded masking rules for role X" / "Loaded policy for role Y", we're green.

**Files:**
- Create: `/tmp/test-policy.yaml` (scratch, deleted at end of task)
- Create: `/tmp/test-masking.yaml` (scratch, deleted at end of task)

- [ ] **Step 1: Write minimal test policy**

Write `/tmp/test-policy.yaml`:

```yaml
gpdb:
  all:
    allowed: []
    denied: []
    readonly: true
  readonly:
    allowed: ["SELECT", "EXPLAIN", "SHOW"]
    denied: []
    readonly: true
  analyst:
    allowed: []
    denied: ["INSERT","UPDATE","DELETE","DROP","TRUNCATE","ALTER"]
    readonly: true
  admin:
    allowed: []
    denied: ["DROP DATABASE","TRUNCATE"]
    readonly: false
```

- [ ] **Step 2: Write minimal test masking**

Write `/tmp/test-masking.yaml`:

```yaml
masking:
  enabled: true
  default_method: NONE
  roles:
    readonly:
      enabled: true
      columns:
        - { schema: public, table: customer, column: c_email_address, method: FULL }
        - { schema: public, table: customer, column: c_customer_id,   method: PARTIAL, show_last: 4 }
    analyst:
      enabled: true
      columns:
        - { schema: public, table: customer, column: c_email_address, method: email }
        - { schema: public, table: customer, column: c_birth_year,    method: HASH }
    admin:
      enabled: false
```

- [ ] **Step 3: Copy both into the running container and point config at them**

```bash
docker cp /tmp/test-policy.yaml  gp-mcp-demo-mcp-1:/app/policy.yaml
docker cp /tmp/test-masking.yaml gp-mcp-demo-mcp-1:/app/masking.yaml

# Append the paths to config.yaml on the container:
docker exec gp-mcp-demo-mcp-1 sh -c "cat >> /app/config.yaml <<'Y'

service:
  policy_path: /app/policy.yaml
  masking_path: /app/masking.yaml
Y"
docker compose restart mcp
sleep 3
docker compose logs --tail=60 mcp | grep -iE 'policy|masking'
```

**Expected:** log lines along the lines of `Loaded policy from /app/policy.yaml` and `Loaded masking from /app/masking.yaml` (or role-scoped variants). NO errors about `unknown field`, `invalid default_method`, `unsupported method`, `masking file not found`.

- [ ] **Step 4: Probe with each persona**

```bash
# viewer: should succeed for customer (narrow scope already set up)
TOKEN=$(curl -sk -X POST https://localhost/api/login \
  -d 'email=viewer@email.com&password=password' | jq -r .token)
curl -sk -X POST https://localhost/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"execute_query","arguments":{"query":"SELECT c_customer_id, c_email_address, c_first_name FROM customer LIMIT 1"}}}'
```

**Expected:** JSON response body includes `***REDACTED***` or `***...` for `c_first_name` and `c_email_address`, and last-4 only for `c_customer_id`.

**If the probe fails** (config schema is different from this hypothesis):
- Read `docker compose logs mcp` for the exact error.
- Adjust the YAML shape per the error.
- Repeat step 3 until both files load cleanly.
- Document the actual shape in a comment at the top of the spec revision for follow-up plan tasks.

- [ ] **Step 5: Tear down the scratch config**

```bash
docker exec gp-mcp-demo-mcp-1 rm /app/policy.yaml /app/masking.yaml
# revert config.yaml edit — cleanest path is to recreate the container:
docker compose up -d --force-recreate mcp
rm /tmp/test-policy.yaml /tmp/test-masking.yaml
```

**No commit for task 1 — this is discovery only.**

---

## Task 2: Greenplum GRANTs + FeauxAuth seed cleanup

**Files:**
- Modify: `docker/setup-demo-users.sh`

- [ ] **Step 1: Add `date_dim` to readonly grants and switch seed emails to `@email.com`**

Open `docker/setup-demo-users.sh`. Find the block:

```sql
-- readonly: narrow slice of tpcds
GRANT SELECT ON customer, store_sales, item TO readonly_user;
```

Replace with:

```sql
-- readonly: narrow slice of tpcds (viewer persona scope)
GRANT SELECT ON customer, store_sales, item, date_dim TO readonly_user;
```

Then find the three `create_feauxauth_user` lines:

```bash
create_feauxauth_user "viewer@feauxauth.local"  "Demo Viewer"  "readonly"
create_feauxauth_user "analyst@feauxauth.local" "Demo Analyst" "analyst"
create_feauxauth_user "dba@feauxauth.local"     "Demo DBA"     "admin"
```

Replace with:

```bash
create_feauxauth_user "viewer@email.com"  "Demo Viewer"  "readonly"
create_feauxauth_user "analyst@email.com" "Demo Analyst" "analyst"
create_feauxauth_user "dba@email.com"     "Demo DBA"     "admin"
```

And update the trailing `cat <<EOF` help block to the new addresses too.

- [ ] **Step 2: Delete legacy `@feauxauth.local` demo users from the live FeauxAuth DB**

```bash
for id in $(curl -sku admin:feauxauth https://localhost/api/admin/users \
  | jq -r '.[] | select(.email | endswith("@feauxauth.local")) | select(.email != "demo@feauxauth.local") | .id'); do
  curl -sku admin:feauxauth -X DELETE "https://localhost/api/admin/users/$id" -o /dev/null -w "deleted $id HTTP %{http_code}\n"
done
```

Expected: three HTTP 200/204 responses. The seed `demo@feauxauth.local` is preserved.

- [ ] **Step 3: Re-run the demo-users job to verify the new script is idempotent**

```bash
docker compose up -d --force-recreate demo-users
sleep 5
docker compose logs --tail=30 demo-users | grep -E 'created|exists|ready'
```

Expected output includes:
```
exists  viewer@email.com — skipping
exists  analyst@email.com — skipping
exists  dba@email.com — skipping
Greenplum roles ready: readonly_user, analyst_user
```

- [ ] **Step 4: Verify the new GRANT**

```bash
docker exec gp-mcp-demo-greenplum-1 psql -U gpadmin -d tpcds -tAc \
  "SELECT has_table_privilege('readonly_user','date_dim','SELECT');"
```

Expected: `t`

- [ ] **Step 5: Commit**

```bash
git add docker/setup-demo-users.sh
git commit -m "Widen viewer GRANTs to include date_dim; seed @email.com users

date_dim lets the viewer answer time-filtered questions in the
store-channel fallback path of the demo arc. Seed addresses now match
the live FeauxAuth data; @feauxauth.local dupes are cleaned up.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Write and deploy `policy.yaml`

**Files:**
- Create: `policy.yaml` (repo root)
- Modify: `docker-compose.yml`
- Modify: `mcp-docker-config.yaml`

- [ ] **Step 1: Create `policy.yaml` at repo root**

```yaml
# Per-role SQL statement policy for the Greenplum MCP server.
# Role names correspond to `name` fields in mcp-docker-config.yaml
# permission_levels. The `all` role is the default/fallback.
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
    denied: ["TRUNCATE"]
```

> Task-1 smoke test finding: the policy validator accepts only bare
> statement-type tokens from a fixed list (SELECT, INSERT, UPDATE, DELETE,
> CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE, COPY, VACUUM, ANALYZE,
> REINDEX, SHOW, EXPLAIN, DESCRIBE, WITH, UNION, BEGIN, COMMIT, ROLLBACK,
> SET, RESET). Granular forms like `"DROP DATABASE"` fail validation with
> `invalid statement type 'DROP DATABASE'`. The spec's DB-drop safety net
> therefore relies on Greenplum GRANTs (only `gpadmin` has superuser) and
> DBA trust, not MCP policy.

- [ ] **Step 2: Mount it into the mcp container**

Edit `docker-compose.yml`. In the `mcp:` service `volumes:` block, add a line after the config.yaml mount:

```yaml
      - ./mcp-docker-config.yaml:/app/config.yaml:ro
      - ./policy.yaml:/app/policy.yaml:ro
```

- [ ] **Step 3: Point the MCP server at the policy file**

Edit `mcp-docker-config.yaml`. Inside the existing `service:` block, add `policy_path`:

```yaml
service:
  gpdb:
    host: greenplum-sne
    port: 5432
    database: tpcds
    username: "gpadmin"
    password: "VMware1!"
  policy_path: /app/policy.yaml
```

- [ ] **Step 4: Restart mcp and verify load**

```bash
docker compose up -d --force-recreate mcp
sleep 4
docker compose logs mcp --tail=80 | grep -iE 'policy|role'
```

Expected: log line indicating the policy file was loaded; no parse errors.

- [ ] **Step 5: Functional check — policy denies UPDATE for analyst**

Log in as `analyst@email.com` in the data-chat UI and send: *"Update the customer with c_customer_id='AAAAAAAABAAAAAAA' to set c_email_address='test@x.com'."* Expected: red permission-denied card, no retry.

Switch to `dba@email.com` and ask the same. Expected: the UPDATE runs and reports `UPDATE 1` (or the model asks for confirmation first — either is acceptable).

- [ ] **Step 6: Commit**

```bash
git add policy.yaml docker-compose.yml mcp-docker-config.yaml
git commit -m "Add per-role MCP policy.yaml (readonly/analyst/admin)

viewer and analyst are readonly; admin can write but TRUNCATE and
DROP DATABASE are denied as a safety net.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Write and deploy `masking.yaml`

Depends on task 1 having confirmed the exact YAML shape. If task 1 surfaced a different shape, the file below must be adjusted to match.

**Files:**
- Create: `masking.yaml` (repo root)
- Modify: `docker-compose.yml`
- Modify: `mcp-docker-config.yaml`

- [ ] **Step 1: Create `masking.yaml` at repo root**

```yaml
# Column-level masking rules per role. Methods verified present in
# GA 1.0.0: FULL, PARTIAL (show_last: N), HASH, email, NULL, random, NONE.
masking:
  enabled: true
  default_method: NONE
  roles:
    readonly:
      enabled: true
      columns:
        - { schema: public, table: customer, column: c_email_address, method: FULL }
        - { schema: public, table: customer, column: c_first_name,    method: FULL }
        - { schema: public, table: customer, column: c_last_name,     method: FULL }
        - { schema: public, table: customer, column: c_birth_year,    method: FULL }
        - { schema: public, table: customer, column: c_login,         method: FULL }
        - { schema: public, table: customer, column: c_customer_id,   method: PARTIAL, show_last: 4 }
    analyst:
      enabled: true
      columns:
        - { schema: public, table: customer, column: c_email_address, method: email }
        - { schema: public, table: customer, column: c_birth_year,    method: HASH }
    admin:
      enabled: false
```

- [ ] **Step 2: Mount it into the mcp container**

Edit `docker-compose.yml` — add a line in the `mcp:` service `volumes:` block:

```yaml
      - ./mcp-docker-config.yaml:/app/config.yaml:ro
      - ./policy.yaml:/app/policy.yaml:ro
      - ./masking.yaml:/app/masking.yaml:ro
```

- [ ] **Step 3: Point the MCP server at the masking file**

Edit `mcp-docker-config.yaml`. Add `masking_path` alongside `policy_path`:

```yaml
service:
  gpdb:
    host: greenplum-sne
    port: 5432
    database: tpcds
    username: "gpadmin"
    password: "VMware1!"
  policy_path: /app/policy.yaml
  masking_path: /app/masking.yaml
```

- [ ] **Step 4: Restart mcp and verify load**

```bash
docker compose up -d --force-recreate mcp
sleep 4
docker compose logs mcp --tail=80 | grep -iE 'masking'
```

Expected: log lines indicating the masking rules loaded for roles `readonly` and `analyst`; no `invalid default_method`, no `unknown method`, no `masking file not found`.

- [ ] **Step 5: Functional check — three different rows**

In the data-chat UI with all three personas selected (compare mode), send: *"Show me the first row from customer with c_customer_id, c_email_address, c_first_name, c_birth_year."*

Expected:
- Viewer: `c_customer_id` last-4 only; other three columns `***REDACTED***`.
- Analyst: `c_customer_id` and `c_first_name` clear; `c_email_address` shows `***@<domain>`; `c_birth_year` is a hashed fake year.
- DBA: all values clear.

- [ ] **Step 6: Commit**

```bash
git add masking.yaml docker-compose.yml mcp-docker-config.yaml
git commit -m "Add per-role column masking for customer PII

readonly redacts name/email/birth/login and shows last-4 of customer_id.
analyst keeps email domain visible (email method) and hashes birth_year.
admin has masking disabled.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Extend `PersonaConfig.Persona` with `systemPrompt` and `allowedTools`

**Files:**
- Modify: `data-chat/src/main/java/com/baskettecase/datachat/config/PersonaConfig.java`
- Modify: `data-chat/src/main/java/com/baskettecase/datachat/config/PersonaConfigValidator.java` (only if it enforces a required-fields list — a quick read will tell)

- [ ] **Step 1: Add two fields to the `Persona` record**

Open `PersonaConfig.java`. The record currently reads:

```java
public record Persona(
    String id,
    String label,
    String description,
    String authProvider,
    String mcpServer
) {}
```

Replace with:

```java
public record Persona(
    String id,
    String label,
    String description,
    String authProvider,
    String mcpServer,
    String systemPrompt,
    List<String> allowedTools
) {
    /** Safe accessor: null → empty list (all tools allowed). */
    public List<String> allowedToolsOrEmpty() {
        return allowedTools == null ? List.of() : allowedTools;
    }

    /** Safe accessor: null/blank → fallback. */
    public String systemPromptOr(String fallback) {
        return (systemPrompt == null || systemPrompt.isBlank()) ? fallback : systemPrompt;
    }
}
```

Spring Boot's `@ConfigurationProperties` binding populates records positionally by name, so absent fields bind to null — no existing personas.yaml breaks.

- [ ] **Step 2: Look at the validator for required-field constraints**

Open `PersonaConfigValidator.java`. Read it. If it asserts a closed list of required fields (e.g. iterating known property names), add no check for `systemPrompt` or `allowedTools` — both are optional. If it doesn't constrain fields at all, skip to step 3.

- [ ] **Step 3: Compile-check**

```bash
cd data-chat && ./mvnw -q -DskipTests compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add data-chat/src/main/java/com/baskettecase/datachat/config/PersonaConfig.java
git commit -m "Add systemPrompt + allowedTools fields to Persona config

Optional — null systemPrompt falls back to global, null allowedTools
means 'all tools'. Backward compatible with existing personas.yaml.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Wire per-persona system prompt in `ChatOrchestrator`

**Files:**
- Modify: `data-chat/src/main/java/com/baskettecase/datachat/chat/ChatOrchestrator.java`

- [ ] **Step 1: Inject `PersonaConfig` into the orchestrator**

Open `ChatOrchestrator.java`. The constructor currently takes `ModelRegistry, McpGateway, ConversationStore, AuditEventBus`. Add a fifth parameter `PersonaConfig personas` and store it as a field:

```java
import com.baskettecase.datachat.config.PersonaConfig;

// ... inside the class ...
private final PersonaConfig personas;

public ChatOrchestrator(ModelRegistry models, McpGateway mcp, ConversationStore conversations,
                        AuditEventBus audit, PersonaConfig personas) {
    this.models = models;
    this.mcp = mcp;
    this.conversations = conversations;
    this.audit = audit;
    this.personas = personas;
}
```

Spring will autowire `PersonaConfig` — it's already a `@ConfigurationProperties` bean.

- [ ] **Step 2: Resolve the persona's system prompt at call time**

In `handle(...)`, the existing line is:

```java
var promptSpec = chat.prompt()
    .system(SYSTEM_PROMPT)
    .messages(history)
    .toolCallbacks(callbacks.toArray(new ToolCallback[0]));
```

Change the `.system(...)` argument:

```java
String personaPrompt = personas.personas().stream()
    .filter(p -> p.id().equals(personaId))
    .findFirst()
    .map(p -> p.systemPromptOr(SYSTEM_PROMPT))
    .orElse(SYSTEM_PROMPT);

var promptSpec = chat.prompt()
    .system(SYSTEM_PROMPT + "\n\n=== PERSONA ===\n" + (personaPrompt.equals(SYSTEM_PROMPT) ? "" : personaPrompt))
    .messages(history)
    .toolCallbacks(callbacks.toArray(new ToolCallback[0]));
```

The rationale for concatenating: the global `SYSTEM_PROMPT` owns the invariants (output format, stop-on-deny, safety). The persona prompt is an additive flavor paragraph. If the persona didn't set one, we just use the global prompt unchanged.

- [ ] **Step 3: Compile + quick runtime smoke**

```bash
cd data-chat && ./mvnw -q -DskipTests compile
cd .. && docker compose up -d --build data-chat
sleep 6
curl -sk https://localhost/chat/ -o /dev/null -w 'HTTP %{http_code}\n'
```

Expected: 200.

- [ ] **Step 4: Commit**

```bash
git add data-chat/src/main/java/com/baskettecase/datachat/chat/ChatOrchestrator.java
git commit -m "Prepend per-persona flavor prompt to global system prompt

Global SYSTEM_PROMPT keeps the invariants (output format, stop-on-deny,
safety). Persona-specific additions are appended under a PERSONA
section. Personas with no systemPrompt see the global prompt unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Filter the MCP tool list per persona in `ChatOrchestrator`

**Files:**
- Modify: `data-chat/src/main/java/com/baskettecase/datachat/chat/ChatOrchestrator.java`

- [ ] **Step 1: Resolve the persona's allowed-tools list**

Immediately after the `mcpSession` is opened and before the `.stream()...toList()` pipeline that builds `callbacks`, add:

```java
List<String> allowedTools = personas.personas().stream()
    .filter(p -> p.id().equals(personaId))
    .findFirst()
    .map(PersonaConfig.Persona::allowedToolsOrEmpty)
    .orElse(List.of());
log.info("Persona {} allowedTools policy: {}", personaId, allowedTools.isEmpty() ? "ALL" : allowedTools);
```

- [ ] **Step 2: Apply the filter inside the callback build pipeline**

In the same method, the current code reads:

```java
var tools = mcp.listTools(mcpSession);
log.info("Got {} tools for persona={}", tools.size(), personaId);

callbacks = tools.stream()
    .<ToolCallback>map(t -> { ... })
    .toList();
```

Insert a `.filter(...)` before the `.map(...)`:

```java
var tools = mcp.listTools(mcpSession);
log.info("Got {} tools for persona={}", tools.size(), personaId);

callbacks = tools.stream()
    .filter(t -> allowedTools.isEmpty() || allowedTools.contains(t.name()))
    .<ToolCallback>map(t -> { ... })
    .toList();
log.info("Filtered to {} callbacks for persona={}", callbacks.size(), personaId);
```

An empty `allowedTools` preserves today's behavior (all tools visible).

- [ ] **Step 3: Compile**

```bash
cd data-chat && ./mvnw -q -DskipTests compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add data-chat/src/main/java/com/baskettecase/datachat/chat/ChatOrchestrator.java
git commit -m "Filter MCP tool list to persona's allowedTools

Soft gating — the LLM only sees tools the persona is allowed to use.
Hard enforcement still lives at the DB layer (policy.yaml + GRANTs).
Empty or absent allowedTools means 'no filter' (unchanged behavior).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Populate `personas.yaml` with prompts and tool allowlists

**Files:**
- Modify: `data-chat/config/personas.yaml`

- [ ] **Step 1: Replace the `personas:` block with the full definitions**

Open `data-chat/config/personas.yaml`. The `personas:` block currently reads:

```yaml
personas:
  - id: viewer
    label: "Read-only Viewer"
    description: "SELECT on a narrow slice"
    authProvider: feauxauth
    mcpServer: gp-mcp
  - id: analyst
    label: "Analyst"
    description: "Read all tpcds tables"
    authProvider: feauxauth
    mcpServer: gp-mcp
  - id: dba
    label: "DBA"
    description: "Full privileges"
    authProvider: feauxauth
    mcpServer: gp-mcp
```

Replace with:

```yaml
personas:
  - id: viewer
    label: "Read-only Viewer"
    description: "Customer-support slice — no PII, no ops tools"
    authProvider: feauxauth
    mcpServer: gp-mcp
    systemPrompt: |
      You are a customer-support rep with a narrow read-only view of TPCDS.
      You can look up individual customers and store-channel activity. You
      cannot query web sales, run diagnostics, train models, or modify data.
    allowedTools:
      - list_schemas
      - list_tables
      - describe_tables
      - list_objects
      - get_object_details
      - execute_query
      - explain_query

  - id: analyst
    label: "Analyst"
    description: "Business analytics + ML, read-only"
    authProvider: feauxauth
    mcpServer: gp-mcp
    systemPrompt: |
      You are a business analyst. You have read access to all public tables
      and the Analytics & ML tools. You cannot modify data or run operational
      diagnostics — defer those to the DBA persona.
    allowedTools:
      - list_schemas
      - list_tables
      - describe_tables
      - list_objects
      - get_object_details
      - introspect_database
      - execute_query
      - explain_query
      - analyze_view_dependencies
      - analyze_function_dependencies
      - get_table_madlib_analytics
      - gpmlbot_train
      - gpmlbot_list_models
      - gpmlbot_predict
      - find_largest_databases
      - find_largest_schemas
      - find_largest_tables
      - find_largest_indexes
      - find_largest_partitions
      - analyze_schemas_size

  - id: dba
    label: "DBA"
    description: "Ops, diagnostics, and write access"
    authProvider: feauxauth
    mcpServer: gp-mcp
    systemPrompt: |
      You are a Greenplum DBA. Your focus is cluster health, capacity, and
      operational safety. You have full read/write access plus diagnostics
      tools. Prefer running diagnostics before offering write fixes.
    allowedTools: []   # empty list → all tools exposed
```

Note: the validator expects `authProvider` and `mcpServer` to resolve against the declared `authProviders` / `mcpServers` blocks at the top of the file — don't touch those.

- [ ] **Step 2: Restart data-chat and verify bindings**

```bash
docker compose restart data-chat
sleep 6
docker compose logs data-chat --tail=80 | grep -iE 'persona|allowedTools'
```

Expected: startup completes, no `ConfigurationPropertiesBindException`.

- [ ] **Step 3: Functional check — tool list diverges per persona**

Open the DevPanel in the chat UI (⌘\). Log in as each persona in turn. In the "Tools" tab, confirm:
- `viewer` shows ~7 tools.
- `analyst` shows ~20 tools including `gpmlbot_train`.
- `dba` shows the full 37.

- [ ] **Step 4: Commit**

```bash
git add data-chat/config/personas.yaml
git commit -m "Define persona system prompts and tool allowlists

viewer gets a minimal discovery + execute_query kit.
analyst adds MADlib + gpmlbot + storage analysis.
dba has the full toolset (allowedTools left empty = no filter).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: End-to-end smoke-test the six-query demo arc

No code changes — this is the acceptance run. Use the data-chat compare mode with all three personas selected simultaneously.

**Files:** none (verification only).

- [ ] **Step 1: Q1 — masking reveal**

Prompt: *"Show me the first row from customer with c_customer_id, c_email_address, c_first_name, c_birth_year."*

Expected:
- Viewer: last-4 of `c_customer_id`, everything else `***REDACTED***`.
- Analyst: `c_customer_id`+`c_first_name` clear; email shows `***@<domain>`; birth_year hashed.
- DBA: all clear.

- [ ] **Step 2: Q2 — scope reveal**

Prompt: *"How many orders are in the web_sales table?"*

Expected: viewer returns a red permission-denied card and stops. Analyst + DBA return a count.

- [ ] **Step 3: Q3 — cross-table reveal**

Prompt: *"Which item category generated the most revenue in 2001 through the web channel?"*

Expected: viewer can't (web_sales denied) — stops. Analyst + DBA return a ranked list.

- [ ] **Step 4: Q4 — ops reveal**

Prompt: *"Is the store_sales table healthy? Any bloat, skew, or stale stats?"*

Expected: viewer + analyst decline (no diagnostics tools in their subset). DBA calls `check_table_bloat` / `check_table_skew` / `check_stats_freshness` and returns a health card.

- [ ] **Step 5: Q5 — ML reveal**

Prompt: *"Train a quick classifier to predict customer purchase activity using customer and store_sales."*

Expected: viewer declines (no ML tools). Analyst + DBA call `gpmlbot_train` and return a leaderboard.

- [ ] **Step 6: Q6 — policy reveal**

Prompt: *"Update the customer with c_customer_id='AAAAAAAABAAAAAAA' to set c_email_address='test@x.com'."*

Expected: viewer + analyst red card (policy denies UPDATE). DBA either confirms first or reports `UPDATE 1`.

- [ ] **Step 7: Capture the DEMO.md update**

Edit `DEMO.md`. Replace or add a section titled "Varied Persona Access Demo" that lists the six prompts and the expected per-persona response summary. Keep it tight — this is the cheat sheet that tanzu-video-pipeline will read.

- [ ] **Step 8: Commit**

```bash
git add DEMO.md
git commit -m "Document the six-query persona-compare demo arc

One prompt, three panes, one-line expected behavior per pane.
Reference for tanzu-video-pipeline demo runs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Post-plan: tanzu-video-pipeline input

The video pipeline form needs (Objective / Audience / Duration / Scene Brief).
Deliverable values are in **`docs/superpowers/plans/2026-04-21-video-pipeline-brief.md`** (written as task 10 below, no code changes).

---

## Task 10: Write `docs/superpowers/plans/2026-04-21-video-pipeline-brief.md`

Copy-paste-ready values for the form fields shown in the scene-brief screenshot.

**Files:**
- Create: `docs/superpowers/plans/2026-04-21-video-pipeline-brief.md`

- [ ] **Step 1: Create the brief**

```markdown
# Video Pipeline Brief — Varied Persona Access Demo

Values to paste into the tanzu-video-pipeline scene-brief form.

## Objective *
Show how role-aware MCP access protects a Greenplum database: the same
natural-language prompt produces three visibly different answers across
viewer, analyst, and DBA personas, enforced by object GRANTs, statement
policy, and column masking simultaneously.

## Audience
Data platform leaders and security-minded engineers evaluating AI-to-
database connectors; Greenplum customers already running MCP server;
developers integrating Spring AI clients against the Greenplum MCP server.

## Duration (min)
5

## Scene Brief
6 scenes — all run in data-chat compare mode with viewer / analyst / dba
selected simultaneously. One prompt, three panes per scene.

1. Masking reveal — "Show me the first row from customer with c_customer_id,
   c_email_address, c_first_name, c_birth_year."
   Viewer sees redacted PII + last-4 ID; analyst sees domain-only email +
   hashed birth year; DBA sees clear values. Demonstrates masking.yaml.

2. Scope reveal — "How many orders are in the web_sales table?"
   Viewer is denied at the Greenplum GRANT layer and stops. Analyst + DBA
   return counts.

3. Cross-table reveal — "Which item category generated the most revenue in
   2001 through the web channel?"
   Viewer still denied (web_sales). Analyst + DBA run the join.

4. Ops reveal — "Is store_sales healthy? Any bloat, skew, or stale stats?"
   Viewer + analyst have no diagnostics tools in their subset. DBA runs
   check_table_bloat / check_table_skew / check_stats_freshness.

5. ML reveal — "Train a classifier to predict customer purchase activity
   using customer and store_sales."
   Viewer declines. Analyst + DBA invoke gpmlbot_train and report a
   leaderboard.

6. Policy reveal — "Update the customer with c_customer_id='AAAAAAAABAAAAAAA'
   to set c_email_address='test@x.com'."
   Viewer + analyst blocked by policy.yaml readonly. DBA executes.

Login credentials:
- viewer@email.com / password
- analyst@email.com / password
- dba@email.com / password

Stack URL: https://localhost/chat/
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-21-video-pipeline-brief.md
git commit -m "Video pipeline brief for the persona-access demo

Copy-paste values for the tanzu-video-pipeline scene-brief form.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
