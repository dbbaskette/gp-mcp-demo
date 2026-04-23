# gp-mcp-demo

End-to-end demo stack showing identity-driven database access through the
Model Context Protocol (MCP). Three layers of security — OAuth identity,
MCP policy enforcement, and Greenplum row/table grants — protect a TPC-DS
dataset behind a single HTTPS endpoint.

**Two client options:**

- **Claude Desktop** — wire Claude directly to the MCP server via `mcp-remote`
- **data-chat** — browser-based chat UI (React + Spring Boot) with multi-persona
  split-pane comparison, a developer panel, and pluggable LLM backends
  (Gemini, Claude, OpenAI, and LM Studio for local inference)

All services run in Docker with HTTPS termination via Caddy + mkcert.

## Sibling repos (expected checkout layout)

```
~/Projects/
├── FeauxAuth/              # OIDC authorization server (built here)
├── Tanzu-GP-MCP-Server/    # provides gp-mcp-server-linux-arm64 binary
├── greenplum-sne/          # provides tpcds kit + pre-generated data
└── gp-mcp-demo/            # this repo (docker compose orchestration)
```

## Prerequisites

- Docker Desktop
- `mkcert` (`brew install mkcert`) and one-time `mkcert -install`
- `jq` (`brew install jq`) for the claude-mcp-config toggle
- Greenplum SNE image built: `greenplum-sne-full:latest` (run `../greenplum-sne/build-gpsne.sh --full` if missing)
- TPC-DS data generated: files in `../greenplum-sne/tpcds/data/*.dat` (run `../greenplum-sne/tpcds/setup-tpcds.sh --skip-load` once if missing)

## First-time setup

```bash
# Generate TLS cert for localhost
cd certs && mkcert localhost 127.0.0.1 && cd ..

# Build and start the full stack
docker compose up -d --build

# Create demo OAuth users + matching Greenplum roles,
# and install the shell helpers (mcp, mcp-reload, mcp-log, gpcli, persona-allow).
./setup-demo-users.sh

# Rebuild the stateful bits that don't live in volumes:
#   - /app/gpdb-tools.yaml (custom MCP tool definition)
#   - MADlib extension + ml_workspace schema + analyst grants
#   - public.quarterly_web_sales_revenue view + grants
#   - SSH trust between the mcp container and gpadmin on greenplum
# Every step is idempotent — safe to re-run.
./setup-demo-state.sh
```

First start takes several minutes (Greenplum warm-up + TPC-DS load). On a
full rebuild (`docker compose down && docker compose up -d --build`), re-run
both setup scripts — `setup-demo-users.sh` first, then `setup-demo-state.sh`.

## What runs where

| URL | Serves |
|---|---|
| https://localhost/ | → `/admin/` (FeauxAuth UI) |
| https://localhost/admin/ | FeauxAuth admin console |
| https://localhost/.well-known/openid-configuration | FeauxAuth OIDC discovery |
| https://localhost/oauth/{authorize,token,register,...} | FeauxAuth endpoints |
| https://localhost/mcp | MCP server (requires Bearer token) |
| https://localhost/.well-known/oauth-protected-resource | MCP resource metadata |
| https://localhost/chat/ | data-chat web UI |
| https://localhost/chat/ws/chat | data-chat WebSocket endpoint |
| https://localhost/chat/api/audit/stream | data-chat audit SSE stream (DevPanel) |
| localhost:15432 | Greenplum (gpadmin / VMware1! / tpcds) |

## Using data-chat (browser UI)

Once the stack is running and demo identities exist, open
**https://localhost/chat/** in your browser.

- **Single mode** — pick one persona from the top bar, authenticate via popup,
  and chat normally.
- **Demo mode** — toggle "Demo" in the header, select multiple personas, and
  type a single prompt. Each persona runs the query in parallel in split panes
  so you can compare results side-by-side.
- **DevPanel** (`⌘\`) — inspect decoded JWT claims, live audit events, and
  the MCP tool inventory for each persona.
- **Model picker** — switch between Gemini, Claude, OpenAI, and any LM Studio
  model you have loaded locally. Only providers whose credentials are set in
  `data-chat/.env` appear in the picker; unconfigured providers are silently
  dropped.

### Configuring models

data-chat needs at least one working provider. Copy `data-chat/.env.example` to
`data-chat/.env` and fill in whatever you have:

```bash
# --- API keys (any combination; missing keys drop that provider) ---
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# --- Model selection (shown in the UI picker) ---
# Change and restart data-chat to swap models — no rebuild needed.
OPENAI_MODEL=gpt-5-nano-2025-08-07
# Note: gpt-5 family (gpt-5, gpt-5-mini, gpt-5-nano) only accepts temperature=1.
OPENAI_TEMPERATURE=1

ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_TEMPERATURE=0.7

GEMINI_MODEL=gemini-3-flash-preview
GEMINI_TEMPERATURE=0.7

# --- LM Studio (optional, OpenAI-compatible local inference) ---
# Leave LMSTUDIO_BASE_URL blank to disable.
LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_API_KEY=lm-studio
# Comma-separated; each entry appears as its own option in the UI picker.
LMSTUDIO_MODEL=google/gemma-4-31b,qwen/qwen3.5-9b
LMSTUDIO_TEMPERATURE=0.7
```

Tips:

- LM Studio runs on your host machine — start its OpenAI-compatible server
  (default port 1234) and load the models you listed in `LMSTUDIO_MODEL`.
  On Linux, `docker-compose.yml` maps `host.docker.internal` via `extra_hosts`;
  macOS/Windows get it for free.
- `data-chat/.env` is git-ignored. Changes to model name/temperature only need
  a container restart (`docker compose up -d data-chat --force-recreate`),
  not a rebuild.
- Smaller or local models sometimes emit malformed markdown; data-chat
  post-processes tool-call schemas and markdown tables to keep output
  rendering cleanly across all four providers.

## Create the demo identities

Once the stack is healthy (Greenplum loaded, FeauxAuth reachable at
`https://localhost`), run:

```bash
./setup-demo-users.sh
```

This creates two Greenplum roles (`readonly_user`, `analyst_user`, password
`password`) with tiered SELECT grants, and three FeauxAuth users bound to the
`readonly` / `analyst` / `admin` roles the MCP server maps to permission levels
in [mcp-docker-config.yaml](mcp-docker-config.yaml).

## Wire Claude Desktop to the MCP server

```bash
./claude-mcp-config.sh on        # register gp-mcp in Claude Desktop + restart
./claude-mcp-config.sh off       # remove it + restart
./claude-mcp-config.sh relogin   # clear cached tokens so you can log in as a different user
```

On first launch, `mcp-remote` does OAuth 2.1 + PKCE against FeauxAuth. Log in
as one of the demo users below; tokens are cached under `~/.mcp-auth/`, so use
`relogin` between demo segments to switch identities.

## Demo identities (password for all: `password`)

| FeauxAuth login | JWT role | MCP permission level | Greenplum user | What they can do |
|---|---|---|---|---|
| `viewer@email.com` | `readonly` | readonly | `readonly_user` | SELECT on `customer`, `store_sales`, `item`, `date_dim` |
| `analyst@email.com` | `analyst` | analyst | `analyst_user` | SELECT on all tpcds tables |
| `dba@email.com` | `admin` | admin | `gpadmin` | Full privileges |

Suggested demo flow: ask Claude the same prompt ("list tables", "count rows in
`web_sales`", "drop `item`") after logging in as each user — the viewer hits
`permission denied` on most tables, the analyst reads everything, the DBA can
do DDL.

## Credentials

- FeauxAuth admin UI: `admin` / `feauxauth` at `https://localhost/admin/`
- Demo OIDC users: see table above (all passwords = `password`)
- Greenplum superuser: `gpadmin` / `VMware1!` on `localhost:15432`

## How the pieces fit together

- FeauxAuth's issuer is `https://localhost` (same host Claude sees, matches token `iss`).
- Access tokens include `aud = [client_id, "mcp-server"]` via FeauxAuth's
  `FEAUXAUTH_EXTRA_AUDIENCES` env, so dynamically-registered clients (like
  `mcp-remote`) still satisfy the MCP server's configured `audience: "mcp-server"`.
- Caddy fronts FeauxAuth, MCP, and data-chat on a single `https://localhost`,
  routing `/chat/*` to data-chat, `/mcp*` and
  `/.well-known/oauth-protected-resource` to MCP, and everything else to
  FeauxAuth.
- data-chat forwards the active persona's JWT on every MCP call via
  `TokenForwardingInterceptor` — the MCP server maps the JWT's `roles` claim
  to a Greenplum user, so the same chat prompt produces different results
  depending on who is logged in.
- MCP-to-FeauxAuth JWKS fetch stays on the internal Docker network via
  `http://feauxauth:8080/.well-known/jwks.json`.

## Further reading

- [DEMO.md](DEMO.md) — step-by-step walkthrough for the basic demo
- [DEMO-SECURITY.md](DEMO-SECURITY.md) — focused 20-minute security demo
  (identity, policy, custom tools, audit trail)
