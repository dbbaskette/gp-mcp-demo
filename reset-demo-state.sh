#!/usr/bin/env bash
# Tear down every demo customization built by setup-demo-state.sh (and the
# equivalent on-camera scene flows). Brings the stack back to the "fresh
# compose up" state so a recording or redemo can start from a known slate.
#
# What this resets:
#   1. /app/gpdb-tools.yaml          — removed (MCP reloads back to 37 built-in tools)
#   2. demo-scene views in Greenplum — dropped (list below; extend as scenes add more)
#   3. data-chat/config/personas.yaml — git-checkout'd back to the committed baseline
#                                        (wipes any per-scene allowedTools / systemPrompt drift)
#   4. mcp + data-chat services      — restarted
#
# What this does NOT touch (permanent stack state):
#   - MADlib extension, plpython3u, ml_workspace schema, analyst grants —
#     these are pre-existing infrastructure, not per-scene state.
#   - Greenplum demo users / feauxauth users / gpdata contents.
#   - SSH trust between MCP and Greenplum (needed for gpmlbot and diagnostics).
#
# If you want a TOTAL reset including infrastructure:
#   docker compose down -v && docker compose up -d --build
#   ./setup-demo-users.sh
#   ./setup-demo-state.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
PERSONAS_FILE="$SCRIPT_DIR/data-chat/config/personas.yaml"

MCP_CONTAINER="${MCP_CONTAINER:-gp-mcp-demo-mcp-1}"
DATA_CHAT_CONTAINER="${DATA_CHAT_CONTAINER:-gp-mcp-demo-data-chat-1}"

# Views created by scenes. Add to this list when a new scene ships a view.
DEMO_VIEWS=(
  "public.quarterly_web_sales_revenue"
)

log() { printf '\n==> %s\n' "$*"; }

log "Removing /app/gpdb-tools.yaml in $MCP_CONTAINER"
docker exec "$MCP_CONTAINER" rm -f /app/gpdb-tools.yaml 2>/dev/null || true

if [ ${#DEMO_VIEWS[@]} -gt 0 ]; then
  log "Dropping demo-scene views"
  for v in "${DEMO_VIEWS[@]}"; do
    printf '  DROP VIEW IF EXISTS %s\n' "$v"
  done
  DROP_SQL=""
  for v in "${DEMO_VIEWS[@]}"; do
    DROP_SQL+="DROP VIEW IF EXISTS $v;"
  done
  if command -v gpcli >/dev/null 2>&1; then
    gpcli -c "$DROP_SQL" | tail -n +1
  else
    docker exec -i -u gpadmin -e PGPASSWORD='VMware1!' gp-mcp-demo-greenplum-1 \
      /usr/local/greenplum-db/bin/psql -U gpadmin -h localhost -d tpcds -c "$DROP_SQL"
  fi
fi

log "Reverting $PERSONAS_FILE to committed baseline"
if git -C "$SCRIPT_DIR" diff --quiet -- "$PERSONAS_FILE"; then
  printf '  no local changes\n'
else
  git -C "$SCRIPT_DIR" checkout -- "$PERSONAS_FILE"
  printf '  reverted\n'
fi

log "Restarting $MCP_CONTAINER + $DATA_CHAT_CONTAINER"
DOCKER_CLI_HINTS=false docker restart "$MCP_CONTAINER" "$DATA_CHAT_CONTAINER" >/dev/null
sleep 5

log "Verifying clean state"
LAST_RUN="$(DOCKER_CLI_HINTS=false docker logs --tail 200 "$MCP_CONTAINER" 2>&1 \
  | awk '/Loaded [0-9]+ built-in GPDB tools/{seen=1; last=""} seen{last=last"\n"$0} END{print last}')"
if [ -z "$LAST_RUN" ]; then
  echo "!! couldn't find recent MCP startup marker — restart may not have completed" >&2
  exit 1
fi
if printf '%s' "$LAST_RUN" | grep -q "dynamic tools"; then
  echo "!! current run still shows dynamic tools — check 'mcp-log | grep Loaded' manually" >&2
  exit 1
fi
printf '%s\n' "$LAST_RUN" | grep "built-in GPDB tools" | tail -1

log "Demo state reset to baseline."
cat <<EOF

You can now:
  - Re-record from a clean slate (each scene builds its own state on camera).
  - Rehydrate the full customized demo state with:  ./setup-demo-state.sh
  - Hard-refresh any Data-Chat browser tab to drop stale chat sessions.
EOF
