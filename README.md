# gp-mcp-demo

End-to-end demo stack showing identity-driven database access through the
Model Context Protocol (MCP). Three layers of security — OAuth identity,
MCP policy enforcement, and Greenplum row/table grants — protect a TPC-DS
dataset behind a single HTTPS endpoint.

**Two client options:**

- **Claude Desktop** — wire Claude directly to the MCP server via `mcp-remote`
- **gp-chat** — browser-based chat UI (React + Spring Boot) with multi-persona
  split-pane comparison, a developer panel, and pluggable LLM backends
  (Gemini, Claude, OpenAI)

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
```

First start takes several minutes (Greenplum warm-up + TPC-DS load).

## What runs where

| URL | Serves |
|---|---|
| https://localhost/ | → `/admin/` (FeauxAuth UI) |
| https://localhost/admin/ | FeauxAuth admin console |
| https://localhost/.well-known/openid-configuration | FeauxAuth OIDC discovery |
| https://localhost/oauth/{authorize,token,register,...} | FeauxAuth endpoints |
| https://localhost/mcp | MCP server (requires Bearer token) |
| https://localhost/.well-known/oauth-protected-resource | MCP resource metadata |
| https://localhost/chat/ | gp-chat web UI |
| https://localhost/chat/ws/chat | gp-chat WebSocket endpoint |
| https://localhost/chat/api/audit/stream | gp-chat audit SSE stream (DevPanel) |
| localhost:15432 | Greenplum (gpadmin / VMware1! / tpcds) |

## Using gp-chat (browser UI)

Once the stack is running and demo identities exist, open
**https://localhost/chat/** in your browser.

- **Single mode** — pick one persona from the top bar, authenticate via popup,
  and chat normally.
- **Demo mode** — toggle "Demo" in the header, select multiple personas, and
  type a single prompt. Each persona runs the query in parallel in split panes
  so you can compare results side-by-side.
- **DevPanel** (`⌘\`) — inspect decoded JWT claims, live audit events, and
  the MCP tool inventory for each persona.
- **Model picker** — switch between Gemini, Claude, and OpenAI (only providers
  with API keys in `gp-chat/.env` appear).

gp-chat requires at least one LLM API key. Copy `gp-chat/.env.example` to
`gp-chat/.env` and fill in whichever keys you have:

```bash
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

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
| `viewer@feauxauth.local` | `readonly` | readonly | `readonly_user` | SELECT on `customer`, `store_sales`, `item` |
| `analyst@feauxauth.local` | `analyst` | analyst | `analyst_user` | SELECT on all tpcds tables |
| `dba@feauxauth.local` | `admin` | admin | `gpadmin` | Full privileges |

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
- Caddy fronts FeauxAuth, MCP, and gp-chat on a single `https://localhost`,
  routing `/chat/*` to gp-chat, `/mcp*` and
  `/.well-known/oauth-protected-resource` to MCP, and everything else to
  FeauxAuth.
- gp-chat forwards the active persona's JWT on every MCP call via
  `TokenForwardingInterceptor` — the MCP server maps the JWT's `roles` claim
  to a Greenplum user, so the same chat prompt produces different results
  depending on who is logged in.
- MCP-to-FeauxAuth JWKS fetch stays on the internal Docker network via
  `http://feauxauth:8080/.well-known/jwks.json`.

## Further reading

- [DEMO.md](DEMO.md) — step-by-step walkthrough for the basic demo
- [DEMO-SECURITY.md](DEMO-SECURITY.md) — focused 20-minute security demo
  (identity, policy, custom tools, audit trail)
