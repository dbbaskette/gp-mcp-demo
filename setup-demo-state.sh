#!/usr/bin/env bash
# Rebuild the stateful bits that don't survive `docker compose down && up -d --build`.
# Safe to run multiple times — every step is idempotent.
#
# What this covers (and why setup-demo-users.sh doesn't):
#   1. /app/gpdb-tools.yaml   — custom MCP tool YAML, lives inside the MCP
#                               container with no bind mount, wiped on recreate.
#   2. MADlib extension       — requires CREATE EXTENSION in the tpcds database;
#                               survives in the gpdata volume but first-time
#                               setup or a `docker volume rm gpdata` wipes it.
#   3. ml_workspace schema    — gpmlbot's write scratch space + analyst grants.
#   4. Custom-tool view       — public.quarterly_web_sales_revenue + SELECT grant
#                               to readonly_user and analyst_user.
#   5. SSH trust (MCP→Greenplum) — keypair in /root/.ssh inside MCP container,
#                                  pubkey in gpadmin's authorized_keys on Greenplum.
#                                  Both wiped on container recreate.
#
# Run AFTER `docker compose up -d --build` and `./setup-demo-users.sh`. Order:
#   docker compose up -d --build
#   ./setup-demo-users.sh
#   ./setup-demo-state.sh

set -euo pipefail

MCP_CONTAINER="${MCP_CONTAINER:-gp-mcp-demo-mcp-1}"
GP_CONTAINER="${GP_CONTAINER:-gp-mcp-demo-greenplum-1}"
DATA_CHAT_CONTAINER="${DATA_CHAT_CONTAINER:-gp-mcp-demo-data-chat-1}"
GP_ADMIN_PW="${GP_ADMIN_PW:-VMware1!}"
TPCDS_DB="${TPCDS_DB:-tpcds}"

log() { printf '\n==> %s\n' "$*"; }

wait_for_containers() {
  log "Waiting for containers to be healthy"
  for svc in "$MCP_CONTAINER" "$GP_CONTAINER"; do
    for _ in $(seq 1 60); do
      if docker inspect -f '{{.State.Running}}' "$svc" 2>/dev/null | grep -q true; then
        printf '  %s up\n' "$svc"
        break
      fi
      sleep 2
    done
  done
  for _ in $(seq 1 30); do
    if docker exec -u gpadmin "$GP_CONTAINER" bash -lc \
         "PGPASSWORD='$GP_ADMIN_PW' psql -U gpadmin -h localhost -d $TPCDS_DB -tAc 'SELECT 1' >/dev/null 2>&1"; then
      printf '  greenplum accepting SQL\n'
      return 0
    fi
    sleep 2
  done
  echo "!! greenplum not accepting SQL after 60s — aborting" >&2
  exit 1
}

gp_run() {
  # psql isn't on PATH for a non-login docker exec — use the absolute path.
  docker exec -i -u gpadmin -e PGPASSWORD="$GP_ADMIN_PW" "$GP_CONTAINER" \
    /usr/local/greenplum-db/bin/psql -U gpadmin -h localhost -d "$TPCDS_DB" -v ON_ERROR_STOP=1
}

ensure_madlib() {
  log "Ensuring MADlib extension in $TPCDS_DB"
  if docker exec -u gpadmin "$GP_CONTAINER" bash -lc \
       "PGPASSWORD='$GP_ADMIN_PW' psql -U gpadmin -h localhost -d $TPCDS_DB -tAc \"SELECT 1 FROM pg_extension WHERE extname='madlib'\"" \
       2>/dev/null | grep -q '^1$'; then
    printf '  madlib already installed\n'
  else
    gp_run <<'SQL'
      CREATE EXTENSION IF NOT EXISTS plpython3u;
      CREATE EXTENSION IF NOT EXISTS madlib;
SQL
    printf '  madlib installed\n'
  fi
}

ensure_ml_workspace() {
  log "Ensuring ml_workspace schema + analyst grants"
  gp_run <<'SQL'
    CREATE SCHEMA IF NOT EXISTS ml_workspace;
    GRANT USAGE ON SCHEMA madlib TO analyst_user;
    GRANT SELECT ON ALL TABLES IN SCHEMA madlib TO analyst_user;
    GRANT SELECT ON ALL SEQUENCES IN SCHEMA madlib TO analyst_user;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA madlib TO analyst_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA madlib GRANT SELECT ON TABLES TO analyst_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA madlib GRANT EXECUTE ON FUNCTIONS TO analyst_user;
    GRANT USAGE, CREATE ON SCHEMA ml_workspace TO analyst_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA ml_workspace GRANT ALL ON TABLES TO analyst_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA ml_workspace GRANT ALL ON SEQUENCES TO analyst_user;
SQL
  printf '  ml_workspace + madlib grants in place\n'
}

ensure_demo_view() {
  log "Ensuring public.quarterly_web_sales_revenue view"
  gp_run <<'SQL'
    CREATE OR REPLACE VIEW public.quarterly_web_sales_revenue AS
    SELECT
      EXTRACT(YEAR FROM d.d_date)::int AS year,
      date_trunc('quarter', d.d_date) AS quarter,
      SUM(ws.ws_net_paid) AS revenue,
      COUNT(*) AS transactions
    FROM web_sales ws
    JOIN date_dim d ON ws.ws_sold_date_sk = d.d_date_sk
    GROUP BY 1, 2;
    GRANT SELECT ON public.quarterly_web_sales_revenue TO readonly_user, analyst_user;
SQL
  printf '  view created/refreshed and granted\n'
}

ensure_gpdb_tools() {
  log "Writing /app/gpdb-tools.yaml in $MCP_CONTAINER"
  docker exec -i "$MCP_CONTAINER" sh -c 'cat > /app/gpdb-tools.yaml' <<'YAML'
tools:
  - name: "quarterly_web_sales_revenue"
    description: "Total web_sales revenue aggregated by quarter for the specified year range. Safe for read-only viewers — backed by a pre-aggregated view (no row-level exposure)."
    type: "sql_query"
    parameters:
      - name: "start_year"
        type: "integer"
        default: 2001
      - name: "end_year"
        type: "integer"
        default: 2002
    config:
      query: |
        SELECT quarter, revenue, transactions
        FROM public.quarterly_web_sales_revenue
        WHERE year BETWEEN {{start_year}} AND {{end_year}}
        ORDER BY quarter;
      output_format: "json"
YAML
  printf '  gpdb-tools.yaml written\n'
}

ensure_ssh_trust() {
  log "Ensuring SSH trust: $MCP_CONTAINER -> gpadmin@$GP_CONTAINER"
  docker exec "$MCP_CONTAINER" sh -c '
    mkdir -p /root/.ssh && chmod 700 /root/.ssh
    test -f /root/.ssh/id_rsa || ssh-keygen -t rsa -N "" -f /root/.ssh/id_rsa -q
  '
  PUBKEY="$(docker exec "$MCP_CONTAINER" cat /root/.ssh/id_rsa.pub)"
  docker exec "$GP_CONTAINER" bash -lc "
    su - gpadmin -c '
      mkdir -p ~/.ssh && chmod 700 ~/.ssh
      touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
      grep -qxF \"$PUBKEY\" ~/.ssh/authorized_keys || echo \"$PUBKEY\" >> ~/.ssh/authorized_keys
    '
  "
  docker exec "$MCP_CONTAINER" sh -c '
    ssh-keyscan -H greenplum-sne > /root/.ssh/known_hosts 2>/dev/null
    chmod 600 /root/.ssh/known_hosts
    cat > /root/.ssh/config <<EOF
Host greenplum-sne
  User gpadmin
  StrictHostKeyChecking no
  UserKnownHostsFile /root/.ssh/known_hosts
EOF
    chmod 600 /root/.ssh/config
  '
  if docker exec "$MCP_CONTAINER" ssh -o BatchMode=yes greenplum-sne 'whoami' 2>&1 | grep -q '^gpadmin$'; then
    printf '  ssh greenplum-sne -> gpadmin OK\n'
  else
    echo "!! SSH from $MCP_CONTAINER to greenplum-sne is NOT passwordless" >&2
    exit 1
  fi
}

reload_services() {
  log "Restarting mcp + data-chat so changes take effect"
  docker restart "$MCP_CONTAINER" "$DATA_CHAT_CONTAINER" >/dev/null
  sleep 5
  docker logs --tail 30 "$MCP_CONTAINER" 2>&1 | grep -E "Loaded|dynamic|built-in GPDB tools" | tail -5
}

wait_for_containers
ensure_madlib
ensure_ml_workspace
ensure_demo_view
ensure_gpdb_tools
ensure_ssh_trust
reload_services

log "Done. Demo state is ready."
cat <<EOF

Verification:
  mcp-log | grep -E "dynamic|Loaded"
    -> should show "Loaded 1 dynamic tools from /app/gpdb-tools.yaml"

  gpcli -c "SELECT madlib.version();" | head
    -> should show MADlib 2.2.0 build string

  gpcli -c "\dp public.quarterly_web_sales_revenue"
    -> should show SELECT granted to readonly_user and analyst_user
EOF
