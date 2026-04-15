# gp-chat — Custom MCP Chat Client

**Status:** design
**Date:** 2026-04-14
**Repo:** new service inside `gp-mcp-demo` (monorepo-style), directory `gp-chat/`

## Why

Claude Desktop is a serviceable MCP client but it's a poor demo vehicle for the gp-mcp security story: no in-app login, persona switches require restarting the desktop app, output formatting is generic, and there's no way to show the same prompt landing differently for different users side-by-side. We want a focused chat client that makes the security demo obvious and doubles as a reusable local MCP playground.

## Scope

**In scope (v1):**
- Browser chat app backed by a single Spring Boot service
- OAuth 2.1 + PKCE login per persona, multiple personas authenticated simultaneously inside one browser tab
- Demo mode: same prompt fans out to N selected personas in parallel, rendered side-by-side
- Tool-calling against a configured streamable-http MCP server (gp-mcp in the default config)
- Model picker: Gemini, Anthropic, OpenAI — chosen per request, keys from env vars
- Rich output: markdown, syntax highlighting, collapsible blocks, tool-call cards, LLM-generated HTML cards (stat tiles, styled data tables)
- DevPanel (hotkey): decoded JWT claims per active persona, live audit stream, MCP tool inventory
- Personas, MCP servers, and auth providers defined in a mounted YAML config file

**Out of scope (v1):**
- Settings UI for editing personas / keys / endpoints (v1.1)
- Cloud Foundry deployment (v1.1)
- Persistent conversation storage (in-memory only)
- Ollama / local models
- Accessibility audit, i18n, load testing, visual regression

## Shape

Path-C from brainstorming: demo-first but architected to grow. Personas and MCP endpoints are data, not constants. Adding a second MCP server or a fourth persona is a YAML edit, not a code change.

## System architecture

```
Browser (React SPA) ── https ──► Caddy ──► gp-chat (Spring Boot)
                                              │
                                              ├─► FeauxAuth  (OAuth2 Client per persona)
                                              ├─► gp-mcp     (streamable-http, Bearer: user JWT)
                                              └─► Gemini / Anthropic / OpenAI (via Spring AI)
```

- One new service `gp-chat` on the existing compose network.
- Caddy gets a new route block for `/chat*` → `gp-chat:8080`.
- FeauxAuth, gp-mcp, Greenplum untouched. `gp-chat` registers itself with FeauxAuth using one of two modes configured in `personas.yaml` (see **Persona configuration**): `dynamic` (RFC 7591 self-registration on first boot, client credentials cached to a volume) or `static` (pre-registered `clientId`/`clientSecret` supplied via env). v1 implementation may ship with static-only and add dynamic later — both shapes are expressible in the config schema.
- Spring Boot 3.x, Java 21. Frontend built by `frontend-maven-plugin` into `src/main/resources/static/`. One jar, one image, one `docker compose up`.

## Backend components

Five packages, each with one responsibility:

### `auth`
Spring Security OAuth2 Client, extended for multiple simultaneous sessions.

- `PersonaSessionStore` — in-memory map keyed by `(httpSession, personaId)` holding `OAuth2AuthorizedClient` per slot. Lets one browser tab hold N authenticated personas.
- `PersonaLoginController` — `GET /api/persona/{id}/login` initiates auth for that persona (returns redirect URL for popup). `GET /auth/callback?personaId=...` receives the code, exchanges for tokens, stores under that persona's slot.
- `PersonaInfoController` — `GET /api/persona/{id}` returns `{loggedIn, claims, expiresAt}`; `POST /api/persona/{id}/logout` clears the slot.

### `llm`
Spring AI integration, provider-agnostic.

- Per-provider `ChatModel` bean: `GoogleVertexAiGeminiChatModel`, `AnthropicChatModel`, `OpenAiChatModel`.
- `ModelRegistry` — reads `application.yml`'s `providers.*` block, instantiates only providers whose API key is present, exposes `list()` and `resolve(providerId, modelId)`. UI dropdown reflects what's actually available.

### `mcp`
MCP client, persona-aware.

- One `McpClient` bean per entry in `mcpServers:` config (typically just gp-mcp).
- `TokenForwardingInterceptor` — for each outbound MCP call, pulls the JWT for the active persona from `PersonaSessionStore` and sets `Authorization: Bearer <jwt>`.
- `McpGateway` — the facade the chat layer uses: `listTools(personaId)`, `callTool(personaId, name, args)`.

### `chat`
WebSocket endpoint and tool-calling orchestration.

- `/ws/chat` raw WebSocket endpoint, JSON messages per the schema below (no STOMP).
- `ChatOrchestrator` — stateless per-request: takes (personaId, history, prompt, providerId, modelId), runs the model-calls-tools loop, streams deltas + tool events back.
- `ConversationStore` — in-memory history keyed by `(httpSession, personaId)`.
- `DemoModeService` — given a prompt and a list of personaIds, spawns one `ChatOrchestrator` task per persona in parallel, multiplexes events back to the client tagged with `personaId`.
- `AuditEventBus` — Spring `ApplicationEventPublisher` that every MCP tool call emits to. SSE endpoint at `/api/audit/stream` fans events out to connected DevPanels.

### `web`
Serves the built React SPA from `/`. Exposes `/actuator/health`. Wires up the WebSocket + SSE endpoints.

## Persona configuration

File: `config/personas.yaml`, mounted at `/app/config/personas.yaml` inside the container. Validated on boot — duplicate IDs, missing references, malformed URLs fail-fast with a clear log line.

```yaml
authProviders:
  - id: feauxauth
    issuerUri: https://localhost
    clientRegistrationMode: dynamic    # or "static" with clientId/clientSecret
    scopes: [openid, profile, email]

mcpServers:
  - id: gp-mcp
    url: https://localhost/mcp
    label: "Greenplum MCP"

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

## Frontend structure

React 18 + TypeScript + Vite + Tailwind + shadcn/ui. Theme locked to dark to match the Claude-style rich-card aesthetic.

**Routes:** `/` (chat), `/settings` (model picker + MCP endpoint list; v1 is read-only display of the loaded config).

**Components:**
- `<Shell>` — top bar (persona dropdown or demo-mode toggle, model picker), hotkey handling for DevPanel.
- `<ChatSurface>` — single layout that accepts `personaIds: string[]`. One persona → one pane full-width. Multiple → N equal-width panes sharing one prompt bar at the bottom.
- `<ConversationPane>` — owns one persona's WebSocket subscription, login state, history. Renders a login card if not authenticated, otherwise `<MessageList>`.
- `<MessageList>` / `<MessageBubble>` — renders the assistant message pipeline.
- `<ToolCallCard>` — name, params as pills, status badge, collapsible SQL/result blocks.
- `<DevPanel>` — slide-in right panel, hotkey `⌘\`. Tabs: *Claims*, *Audit* (live SSE stream), *Tools*.

**State:** Zustand store per persona slot (login status, claims, messages, pending tool calls). `<DemoModeContext>` fans a single prompt into all active slot stores simultaneously.

**Auth popup flow:** "Log in as X" opens `/api/persona/X/login` in a popup → FeauxAuth → `/auth/callback?personaId=X` closes popup, posts message to opener, opener refetches `/api/persona/X`. No full-page redirects.

## WebSocket message schema

Client → server:
```
{ type: "user_message", personaId: string, content: string, providerId: string, modelId: string }
{ type: "demo_message",  personaIds: string[], content: string, providerId: string, modelId: string }
{ type: "reset",         personaId: string }
```

Server → client:
```
{ type: "assistant_delta",  personaId, text }
{ type: "tool_call_start",  personaId, id, name, args }
{ type: "tool_call_result", personaId, id, status: "success"|"error"|"denied", result }
{ type: "assistant_done",   personaId }
{ type: "auth_required",    personaId }                # token expired/missing
{ type: "error",            personaId, code, message }
```

## Data flow — one prompt

**Single mode:**
1. SPA sends `user_message` over WebSocket.
2. `ChatOrchestrator` loads history, fetches `McpGateway.listTools(personaId)` for the current tool inventory.
3. Builds request: system prompt (includes rich-HTML-card instructions) + history + tool defs → `ChatClient.stream(...)` on the selected provider.
4. Streams text deltas as `assistant_delta`.
5. If model emits tool call: emit `tool_call_start`, call `McpGateway.callTool(...)` which forwards the persona JWT, emit `tool_call_result`, feed result back to the model, loop.
6. Emit `assistant_done`, persist turn.

**Demo mode:** `DemoModeService` receives one `demo_message`, spawns N orchestrator tasks (one per selected persona) via a virtual-thread executor, multiplexes their events back. Each persona runs an independent loop with its own JWT and its own conversation history.

## Rich-output rendering pipeline

System prompt instructs the model to wrap summary/visual content in a small allowlist of custom tags:
- `<card title="...">...</card>`
- `<statgrid>` containing `<stat label="..." value="..." sub="..." />` elements
- `<datatable>` with `<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` — the model emits this, frontend styles it

Everything outside those tags is plain markdown.

**Frontend rendering (per assistant message):**
1. Feed through `react-markdown` with a rehype pipeline.
2. DOMPurify sanitizes with a strict allowlist: the custom tags above + their attributes, standard markdown HTML, nothing else. No `<script>`, no `<iframe>`, no `on*` attrs, no `javascript:` URLs.
3. Custom-tag elements get replaced with React components (`<RichCard>`, `<StatTile>`, `<StyledTable>`) styled with Tailwind design tokens matching the dark/accent aesthetic.

## Error handling

| Surface | Behaviour |
|---|---|
| OAuth token expired/missing on MCP call | Emit `auth_required`, UI flips pane to "Log in as X" card, pending tool call retried after re-auth |
| MCP server 5xx / unreachable | Emit `tool_call_result` with `status: "error"`, model sees the failure and narrates it; no retry |
| DB permission denied / policy denial | Normal `tool_call_result` with `status: "denied"`; renderer styles distinctly (amber, not red) — expected during security demo |
| LLM provider 4xx/5xx | Stream closes with `error` event; UI toast; conversation preserved |
| Missing API key at boot | Provider removed from `ModelRegistry`; UI dropdown adapts |
| `personas.yaml` invalid | Boot fails with a readable log line naming the offending entry |
| WebSocket drop | Auto-reconnect with exponential backoff; in-flight tool-call spinners cleared |

Explicit non-goals in v1: retry logic, message-queue persistence, offline mode, zombie-proof state recovery after a backend crash.

## Testing strategy

| Layer | Framework | Focus |
|---|---|---|
| Unit | JUnit 5 | `PersonaSessionStore` isolation, `ModelRegistry` provider-dropout, `TokenForwardingInterceptor` JWT selection, HTML sanitizer allowlist, config validation |
| Integration | `@SpringBootTest` + Testcontainers | OAuth redirect E2E against a containerised IdP + mock MCP server; `ChatOrchestrator` tool loop; `DemoModeService` parallel isolation |
| Frontend | Vitest + RTL | `<MessageList>` rendering, `<ConversationPane>` event routing, mocked login popup, demo-mode pane count |
| E2E | Playwright, one happy-path test | Boot the real compose stack, log in as analyst, send a prompt, assert tool-call card + rich card render |

LLM calls always mocked in CI (Spring AI's test `ChatModel`). No real API usage in tests.

## Deployment

New service in the existing `docker-compose.yml`:

```yaml
  gp-chat:
    build: ./gp-chat
    depends_on:
      feauxauth: { condition: service_started }
      mcp:       { condition: service_started }
    environment:
      GEMINI_API_KEY:    ${GEMINI_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OPENAI_API_KEY:    ${OPENAI_API_KEY:-}
      FEAUXAUTH_ISSUER_URI: https://localhost
    volumes:
      - ./gp-chat/config/personas.yaml:/app/config/personas.yaml:ro
```

Caddy gets a new `/chat*` route pointing at `gp-chat:8080`. Keys provided in a `.env` file (git-ignored) next to `docker-compose.yml`.

## Open questions (for later, not blocking v1)

- Whether to support non-FeauxAuth OIDC providers in config. (Yes in principle, but we only test FeauxAuth in v1.)
- Persistent conversation storage — H2 vs Postgres vs keep it in-memory. Defer until someone complains.
- Cloud Foundry deployment — reuse FeauxAuth's `manifest.yml` pattern. Defer.
- Settings UI for editing personas at runtime. v1.1.

## File layout

```
gp-mcp-demo/
├── gp-chat/                                    # new
│   ├── Dockerfile
│   ├── pom.xml
│   ├── config/
│   │   └── personas.yaml
│   ├── src/main/java/com/baskettecase/gpchat/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── llm/
│   │   ├── mcp/
│   │   └── web/
│   ├── src/main/resources/application.yml
│   └── frontend/                               # Vite + React, built into static/
│       ├── package.json
│       ├── src/
│       └── index.html
├── docker-compose.yml                          # add gp-chat service
├── Caddyfile                                   # add /chat route
└── docs/superpowers/specs/
    └── 2026-04-14-gp-chat-design.md            # this file
```
