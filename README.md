# gp-mcp-demo

End-to-end demo stack: Claude Desktop → Tanzu Greenplum MCP Server (OAuth-protected)
→ FeauxAuth (OIDC authorization server) → Greenplum (TPC-DS dataset).

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
| localhost:15432 | Greenplum (gpadmin / VMware1! / tpcds) |

## Wire Claude Desktop to the MCP server

```bash
./claude-mcp-config on    # adds gp-mcp to Claude Desktop + restarts it
./claude-mcp-config off   # removes it + restarts
```

On first launch, `mcp-remote` does OAuth 2.1 + PKCE against FeauxAuth; log in as
`demo@feauxauth.local` / `password`. Tokens are cached under `~/.mcp-auth/`.

## Credentials

- FeauxAuth admin UI: `admin` / `feauxauth`
- Demo OIDC user: `demo@feauxauth.local` / `password` (has roles: `analyst,user`)
- Greenplum: `gpadmin` / `VMware1!`

## How the pieces fit together

- FeauxAuth's issuer is `https://localhost` (same host Claude sees, matches token `iss`).
- Access tokens include `aud = [client_id, "mcp-server"]` via FeauxAuth's
  `FEAUXAUTH_EXTRA_AUDIENCES` env, so dynamically-registered clients (like
  `mcp-remote`) still satisfy the MCP server's configured `audience: "mcp-server"`.
- Caddy fronts both FeauxAuth and MCP on a single `https://localhost`, routing
  `/mcp*` and `/.well-known/oauth-protected-resource` to MCP and everything else
  to FeauxAuth.
- MCP-to-FeauxAuth JWKS fetch stays on the internal Docker network via
  `http://feauxauth:8080/.well-known/jwks.json`.
