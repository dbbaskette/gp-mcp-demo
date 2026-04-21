# Security & Extensibility Demo Guide

A focused ~20-minute walkthrough of what the Tanzu Greenplum MCP server actually gives you beyond "Claude talks to a database." Built on the local docker stack in this repo. Query results are not the point — the **controls around** the queries are.

Four segments, each ~5 minutes:

1. **Identity-driven DB access** — one JWT role → one Greenplum login
2. **SQL policy enforcement** — per-role allow/deny at the MCP layer
3. **Custom tool definition** — register a SQL query as a first-class MCP tool
4. **Audit trail + wrap-up** — show the evidence

Prereqs: [DEMO.md](DEMO.md) §1-§4 complete. The three personas (`viewer`, `analyst`, `dba`) exist in FeauxAuth, and Greenplum has `readonly_user` and `analyst_user` with tiered grants.

---

## Segment 1 — Identity-driven DB access (5 min)

**What you're showing:** the same Claude client, same MCP endpoint, same natural-language prompt produces different results because Greenplum enforces the identity.

**Mechanism to call out:**
- OAuth 2.1 + PKCE between Claude and FeauxAuth; the MCP server is a pure resource server.
- JWT `roles` claim → [mcp-docker-config.yaml](mcp-docker-config.yaml) `auth.oauth2.permission_levels` → a specific Greenplum login.
- MCP server connects to Greenplum **as that user** — privileges are enforced by the database, not by the LLM.

**Demo script** (between each persona: `./claude-mcp-config.sh relogin`):

| Persona | Prompt | Expected |
|---|---|---|
| `viewer@email.com` | "Show me a few recent web orders." | permission denied |
| `viewer@email.com` | "Who are a few of our customers?" | works |
| `analyst@email.com` | "What do our recent web sales look like?" | works |
| `analyst@email.com` | "Get rid of the product catalog — we don't need it anymore." | permission denied (no DDL grant) |
| `dba@email.com` | "Spin up a scratch table I can use for audit notes." | works |

**Talking point:** *"Delegation to a shared service account is Tier 2 in our security guide; here we're showing User Access — Tier 3 — where each request carries the user's identity all the way to the data."*

---

## Segment 2 — SQL policy enforcement at the MCP layer (5 min)

**What you're showing:** even if the Greenplum user *could* run a statement, the MCP server can refuse it per-role. This is defence-in-depth and also lets you constrain AI agents without rewriting DB grants.

### Setup (one time)

Drop a policy file into the mcp container's home directory. Create [policy.yaml](policy.yaml) next to `mcp-docker-config.yaml`:

```yaml
# Server-side SQL policy, applied after JWT → role resolution.
# Even if the DB user has privileges, the MCP server rejects anything
# outside the statement allow-list for that role.
gpdb:
  all:                          # applies to every authenticated user
    readonly: true
    allowed: [SELECT, EXPLAIN, SHOW]
    denied:  [DROP, TRUNCATE, ALTER, GRANT, REVOKE, CREATE]

  readonly:                     # narrow the viewer even further
    readonly: true
    allowed: [SELECT]
    denied:  [EXPLAIN]

  analyst:
    readonly: true
    allowed: [SELECT, EXPLAIN, SHOW, WITH]

  admin:                        # DBA persona gets write access
    readonly: false
    allowed: [SELECT, EXPLAIN, SHOW, WITH, INSERT, UPDATE, DELETE,
              CREATE, DROP, ALTER, TRUNCATE]
```

Wire it into the container — add one line to the `mcp` service volumes in [docker-compose.yml](docker-compose.yml):

```yaml
    volumes:
      - ../Tanzu-GP-MCP-Server/gp-mcp-server-linux-arm64:/app/gp-mcp-server:ro
      - ./mcp-docker-config.yaml:/app/config.yaml:ro
      - ./policy.yaml:/app/policy.yaml:ro             # ← add this
```

And point the server at it by adding `--policy-file=/app/policy.yaml` to the `command:` array. Then `docker compose up -d mcp`.

### Demo script

| Persona | Prompt | Expected | Reason |
|---|---|---|---|
| `analyst@email.com` | "Add a test customer named Jane Doe for me." | blocked by MCP | policy denies writes for analyst, even though the DB would too |
| `analyst@email.com` | "What are the biggest tables in the warehouse?" | works | reads are allowed |
| `dba@email.com` | "Jot a note into that scratch audit table you just made." | works | admin role has write access in policy |
| `dba@email.com` | Comment `CREATE` out of admin's allow-list, restart mcp, retry "make me another scratch table" | blocked | MCP policy change only — no database change needed |

**Talking point:** *"Grants are durable and coarse. Policy is an ops-level lever — you can tighten what the agent is allowed to do without touching database roles. Two independent authorization layers, both evaluated on every request."*

---

## Segment 3 — Custom query as a first-class MCP tool (5 min)

**What you're showing:** the LLM doesn't have to reason SQL from scratch. A DBA can package a well-tested query as a **named MCP tool** with typed parameters. Claude then calls it like any built-in.

### Setup (one time)

Create [gpdb-tools.yaml](gpdb-tools.yaml) in this repo — the MCP server auto-loads this file from its home directory:

```yaml
tools:
  - name: "tpcds_top_customers_by_state"
    description: |
      Returns the top-N TPC-DS customers by total store sales for a
      given US state. Use when the user asks for "best customers",
      "top spenders", or revenue leaders in a specific state.
    type: "sql_query"
    parameters:
      - name: "state"
        type: "string"
        default: "CA"
      - name: "limit"
        type: "integer"
        default: 10
    config:
      query: |
        SELECT c.c_customer_id,
               c.c_first_name || ' ' || c.c_last_name AS customer_name,
               SUM(ss.ss_net_paid)                    AS total_sales
        FROM   store_sales      ss
        JOIN   customer         c ON ss.ss_customer_sk = c.c_customer_sk
        JOIN   customer_address a ON c.c_current_addr_sk = a.ca_address_sk
        WHERE  a.ca_state = '{{state}}'
        GROUP BY c.c_customer_id, customer_name
        ORDER BY total_sales DESC
        LIMIT {{limit}}
      output_format: "json"

  - name: "tpcds_sales_by_channel"
    description: "Total net-paid sales by channel (store/web/catalog) for a year"
    type: "sql_query"
    parameters:
      - name: "year"
        type: "integer"
        default: 2001
    config:
      query: |
        SELECT 'store'   AS channel, SUM(ss_net_paid) AS total
        FROM   store_sales ss JOIN date_dim d ON ss.ss_sold_date_sk = d.d_date_sk
        WHERE  d.d_year = {{year}}
        UNION ALL
        SELECT 'web',    SUM(ws_net_paid)
        FROM   web_sales ws JOIN date_dim d ON ws.ws_sold_date_sk = d.d_date_sk
        WHERE  d.d_year = {{year}}
        UNION ALL
        SELECT 'catalog', SUM(cs_net_paid)
        FROM   catalog_sales cs JOIN date_dim d ON cs.cs_sold_date_sk = d.d_date_sk
        WHERE  d.d_year = {{year}}
      output_format: "json"
```

Add the mount + `MCP_HOME` is already `/app`, so drop it alongside the config:

```yaml
    volumes:
      - ./gpdb-tools.yaml:/app/gpdb-tools.yaml:ro      # ← add this
```

`docker compose up -d mcp`.

### Demo script

1. **Before:** as `analyst`, ask: *"What can you do against the warehouse?"* — show the built-in list Claude reports (list tables, describe a table, run a query, etc.).
2. **After the mount:** `./claude-mcp-config.sh relogin`, log in again as `analyst`, and ask the same question — the two new tools now show up in the list.
3. *"Who are our best customers in Texas?"* — Claude picks `tpcds_top_customers_by_state` and fills in the state and limit for you.
4. *"How did our sales channels stack up in 2002?"* — Claude calls `tpcds_sales_by_channel` with `year=2002`.
5. *"Same question, but for California and just the top three."* — same tool, different arguments; show the parameters are typed and Claude figures them out from the ask.

**Talking point:** *"The LLM didn't synthesize that query — it called a tool that your DBA wrote, reviewed, and committed to git. This is how you keep the agent on-rails: curated tools for common patterns, `execute_query` as an escape hatch, and the policy file decides whether the escape hatch even exists for this role."*

**Optional punch:** edit the YAML to change `LIMIT {{limit}}` to `LIMIT 3` hard-coded, `docker compose restart mcp`, re-ask — show the tool's behaviour evolves in one file. No code, no redeploy of the server.

---

## Segment 4 — Audit trail (3 min)

Every request — tool name, authenticated user, resolved DB user, SQL, outcome — is appended to the server's audit log.

```bash
docker compose exec mcp tail -n 40 /app/server.log
```

Filter for a persona to tell the story from the logs:

```bash
docker compose exec mcp grep 'viewer@email.com' /app/server.log
```

**Talking point:** *"This is the 'who did what, as whom, and was it allowed' record. It's what lets you answer audit questions about an autonomous agent the same way you'd answer them about a human analyst."*

For a production setup, point `mcp.audit_log.path` at a dedicated file with rotation, ship it to your SIEM, and retain for whatever window your compliance team demands.

---

## Quick reference — everything this demo touches

| Concern | Where it's configured | File in this repo |
|---|---|---|
| Who can log in | FeauxAuth users + roles | `./setup-demo-users.sh` |
| Which DB user each role maps to | `auth.oauth2.permission_levels` | [mcp-docker-config.yaml](mcp-docker-config.yaml) |
| DB-enforced privileges | Greenplum GRANTs | `./setup-demo-users.sh` |
| What SQL statements each role may run | `gpdb.<role>.{allowed,denied,readonly}` | `policy.yaml` (new) |
| Named, parameterised tools | `tools[].config.query` | `gpdb-tools.yaml` (new) |
| TLS to the MCP endpoint | Caddy | [Caddyfile](Caddyfile) |
| What was called, by whom | server / audit log | `docker compose exec mcp tail /app/server.log` |

## Narrative arc (if you want one)

> "Three layers of defence, each at a different boundary:
> 1. **Identity** — the user proves who they are to FeauxAuth over OAuth 2.1 + PKCE; Claude carries a signed, short-lived JWT.
> 2. **Policy** — the MCP server inspects the token's role claim, decides which DB user to become, and filters the SQL the agent is allowed to issue.
> 3. **Grants** — Greenplum enforces what that DB user can actually touch.
>
> On top of that we add **curated tools** so the agent reaches for pre-approved queries before it ever touches the execute_query escape hatch. And everything is logged, per-user, for forensics."

---

## Reset between dry-runs

```bash
docker compose restart mcp              # reload policy/tools
./claude-mcp-config.sh relogin          # force a fresh FeauxAuth login
```
