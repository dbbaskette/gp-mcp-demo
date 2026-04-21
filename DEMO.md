# Demo setup guide

End-to-end walkthrough: zero → three personas asking Claude the same question and getting different answers because Greenplum enforces their role.

---

## 0. One-time prerequisites

Install and verify:

```bash
brew install mkcert jq
mkcert -install                # trusts the local CA in your keychain
docker info                    # Docker Desktop must be running
```

Sibling repos checked out next to this one:

```
~/Projects/
├── FeauxAuth/                 # built from source by docker compose
├── Tanzu-GP-MCP-Server/       # provides gp-mcp-server-linux-arm64
├── greenplum-sne/             # provides TPC-DS kit + generated data
└── gp-mcp-demo/               # ← you are here
```

Make sure these exist before going further:

```bash
docker image inspect greenplum-sne-full:latest >/dev/null \
  || (cd ../greenplum-sne && ./build-gpsne.sh --full)

ls ../greenplum-sne/tpcds/data/*.dat >/dev/null 2>&1 \
  || (cd ../greenplum-sne && ./tpcds/setup-tpcds.sh --skip-load)

ls ../Tanzu-GP-MCP-Server/gp-mcp-server-linux-arm64   # must exist
```

Generate the localhost TLS cert (once):

```bash
cd certs && mkcert localhost 127.0.0.1 && cd ..
```

---

## 1. Bring the stack up

```bash
docker compose up -d --build
```

First boot is slow (Greenplum warm-up + TPC-DS load — several minutes). Watch progress:

```bash
docker compose logs -f greenplum tpcds-loader
```

Wait until `tpcds-loader` exits with `tpcds load complete.` and:

```bash
curl -sk https://localhost/.well-known/openid-configuration | jq .issuer
# → "https://localhost"
```

---

## 2. Create the three demo identities

```bash
./setup-demo-users.sh
```

This creates:

| Layer | Object | Notes |
|---|---|---|
| Greenplum | `readonly_user` | SELECT on `customer`, `store_sales`, `item` only |
| Greenplum | `analyst_user` | SELECT on all tpcds tables |
| FeauxAuth | `viewer@email.com` | role `readonly` |
| FeauxAuth | `analyst@email.com` | role `analyst` |
| FeauxAuth | `dba@email.com` | role `admin` |

Password for every new account: **`password`**. The script is idempotent — safe to re-run.

The role in each JWT tells the MCP server which entry in [mcp-docker-config.yaml](mcp-docker-config.yaml) `permission_levels` to use, which in turn decides which Greenplum user it connects as.

---

## 3. Wire Claude Desktop

```bash
./claude-mcp-config.sh on
```

This registers `gp-mcp → https://localhost/mcp` in `~/Library/Application Support/Claude/claude_desktop_config.json` and restarts Claude Desktop.

---

## 4. Do a first OAuth login to prove the stack works

1. In Claude Desktop, start a new conversation and ask: "what tools do you have from gp-mcp?"
2. A browser tab opens on FeauxAuth's login page.
3. Log in as `analyst@email.com` / `password`.
4. Approve the consent screen. Claude receives the token and lists the MCP tools.
5. Ask: "list the tables in the database" — you should see the full TPC-DS schema.

If that works, the plumbing is correct: Claude → Caddy (TLS) → MCP → FeauxAuth (JWT verify) → Greenplum (as `analyst_user`).

---

## 5. Run the demo — same prompts, three identities

Between each persona, run:

```bash
./claude-mcp-config.sh relogin
```

That clears `~/.mcp-auth/` and restarts Claude so the next MCP call forces a fresh FeauxAuth login.

### Persona A — Viewer (`readonly`)

Log in as `viewer@email.com` / `password`. Try:

- "What tables can you see?" — Claude can list schema metadata but queries to most tables return **permission denied**.
- "Select 5 rows from `customer`" — works (granted).
- "Select 5 rows from `web_sales`" — permission denied.
- "Count rows in `store_sales`" — works.

### Persona B — Analyst (`analyst`)

`./claude-mcp-config.sh relogin`, then log in as `analyst@email.com` / `password`.

- "Count rows in `web_sales`" — works.
- "Top 10 items by total sales" — full read access, anything goes.
- "Drop the `item` table" — **permission denied** (no DDL).

### Persona C — DBA (`admin`)

`./claude-mcp-config.sh relogin`, then log in as `dba@email.com` / `password`.

- "Create a temp table `demo_audit`" — works.
- "Drop table `demo_audit`" — works.

Same MCP endpoint, same Claude Desktop, same prompts — three outcomes, enforced by Greenplum grants based on the JWT role.

---

## 6. Bonus: show the JWT

Open `https://localhost/admin/` (admin / `feauxauth`) → **Inspector**. Paste an access token from the Claude logs or from `~/.mcp-auth/*/tokens.json`. Point out:

- `iss` = `https://localhost`
- `aud` includes `mcp-server`
- `roles` claim changes per persona — that single array drives everything downstream.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser warns about cert | Run `mkcert -install` and restart the browser. |
| MCP tools never appear | `docker compose logs mcp` — usually JWKS fetch or audience mismatch. |
| "permission denied" as analyst | The `readonly`/`analyst` DB grants didn't run. Re-run `./setup-demo-users.sh`. |
| Still logging in as old user | You skipped `./claude-mcp-config.sh relogin`. |
| Greenplum won't start | `docker compose logs greenplum`; ensure `greenplum-sne-full:latest` image exists. |

---

## Teardown

```bash
./claude-mcp-config.sh off      # unregister from Claude
docker compose down             # stop containers (keep volumes)
docker compose down -v          # also drop Greenplum + FeauxAuth data
```
