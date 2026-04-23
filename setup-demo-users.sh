#!/usr/bin/env bash
# Creates the three demo identities used by the MCP permission_levels mapping:
#   readonly  → Greenplum readonly_user  (SELECT on a narrow subset)
#   analyst   → Greenplum analyst_user   (SELECT on all tpcds tables)
#   admin     → Greenplum gpadmin        (full privileges)
# And the matching FeauxAuth login users. All passwords are "password".
set -euo pipefail

PASSWORD="password"

GP_SERVICE="greenplum"
GP_SUPERUSER="gpadmin"
GP_DB="tpcds"

FEAUXAUTH_URL="${FEAUXAUTH_URL:-https://localhost}"
FEAUXAUTH_ADMIN_USER="${FEAUXAUTH_ADMIN_USER:-admin}"
FEAUXAUTH_ADMIN_PASS="${FEAUXAUTH_ADMIN_PASS:-feauxauth}"

log() { printf '\n==> %s\n' "$*"; }

# --- Greenplum ----------------------------------------------------------------

gp_psql() {
  docker compose exec -T "$GP_SERVICE" \
    su - "$GP_SUPERUSER" -c "psql -v ON_ERROR_STOP=1 -d $GP_DB -tAc \"$1\""
}

gp_psql_file() {
  docker compose exec -T "$GP_SERVICE" \
    su - "$GP_SUPERUSER" -c "psql -v ON_ERROR_STOP=1 -d $GP_DB" < "$1"
}

log "Creating Greenplum roles + grants (db=$GP_DB)"

tmpsql=$(mktemp)
trap 'rm -f "$tmpsql"' EXIT

cat > "$tmpsql" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='readonly_user') THEN
    CREATE ROLE readonly_user LOGIN PASSWORD '${PASSWORD}';
  ELSE
    ALTER ROLE readonly_user WITH LOGIN PASSWORD '${PASSWORD}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='analyst_user') THEN
    CREATE ROLE analyst_user LOGIN PASSWORD '${PASSWORD}';
  ELSE
    ALTER ROLE analyst_user WITH LOGIN PASSWORD '${PASSWORD}';
  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE ${GP_DB} TO readonly_user, analyst_user;
GRANT USAGE   ON SCHEMA public    TO readonly_user, analyst_user;

-- analyst: read everything in public
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analyst_user;

-- readonly: narrow slice of tpcds
GRANT SELECT ON customer, store_sales, item TO readonly_user;
SQL

gp_psql_file "$tmpsql"
log "Greenplum users ready: readonly_user, analyst_user (password=$PASSWORD), admin uses gpadmin"

# --- FeauxAuth ----------------------------------------------------------------

USERS_JSON=""

refresh_users_cache() {
  USERS_JSON=$(curl -sk -u "${FEAUXAUTH_ADMIN_USER}:${FEAUXAUTH_ADMIN_PASS}" \
    "${FEAUXAUTH_URL}/api/admin/users")
}

user_exists() {
  local email="$1"
  printf '%s' "$USERS_JSON" | grep -Fq "\"email\":\"${email}\""
}

create_feauxauth_user() {
  local email="$1" display="$2" roles="$3"
  if user_exists "$email"; then
    echo "  exists  $email — skipping"
    return 0
  fi
  local body http
  body=$(cat <<JSON
{"email":"${email}","displayName":"${display}","password":"${PASSWORD}","roles":"${roles}"}
JSON
)
  http=$(curl -sk -o /tmp/feauxauth-resp.$$ -w '%{http_code}' \
    -u "${FEAUXAUTH_ADMIN_USER}:${FEAUXAUTH_ADMIN_PASS}" \
    -H 'Content-Type: application/json' \
    -X POST "${FEAUXAUTH_URL}/api/admin/users" \
    -d "$body")
  case "$http" in
    200|201) echo "  created $email ($roles)";;
    *)       echo "  FAILED  $email (HTTP $http):"; cat /tmp/feauxauth-resp.$$; echo; exit 1;;
  esac
  rm -f /tmp/feauxauth-resp.$$
}

log "Waiting for FeauxAuth at ${FEAUXAUTH_URL} ..."
for _ in $(seq 1 60); do
  if curl -sk -o /dev/null -w '%{http_code}' "${FEAUXAUTH_URL}/.well-known/openid-configuration" \
       | grep -q '^200$'; then break; fi
  sleep 2
done

log "Creating FeauxAuth users (password=$PASSWORD)"
refresh_users_cache
# Canonical demo identities use @email.com — matches the GreenplumMCP
# storyboard (Scene 3, 6, 9, 10, 11, 12, 13) and what's been in live use
# since the initial demo setup. If an earlier pass of this script created
# @feauxauth.local variants, delete them via the FeauxAuth admin UI or
# API so the storyboard's `viewer@email.com` / etc. stay the only path.
create_feauxauth_user "viewer@email.com"  "Demo Viewer"  "readonly"
create_feauxauth_user "analyst@email.com" "Demo Analyst" "analyst"
create_feauxauth_user "dba@email.com"     "Demo DBA"     "admin"

# --- Shell helpers on PATH ---------------------------------------------------
# The repo ships seven demo helpers in ./bin/ (mcp, mcp-reload, mcp-log, gpcli,
# persona-allow, personas-show, demo-reset-scene12) that wrap the underlying
# `docker exec` / `docker restart` / `psql` plumbing so demo recordings /
# live sessions read as admin commands against the MCP server, not container
# orchestration.
#
# Install target preference:
#   1. /opt/homebrew/bin — user-writable on Apple Silicon, already on the
#      default macOS PATH for subprocesses (including Claude Code's Bash
#      tool, which doesn't source ~/.zshrc).
#   2. /usr/local/bin  — legacy, often needs sudo on Apple Silicon.
#   3. Print PATH snippet for operator's shell rc as a last resort.

REPO_DIR="$(cd "$(dirname "$0")" && pwd -P)"
HELPERS_DIR="$REPO_DIR/bin"
HELPER_NAMES=(mcp mcp-reload mcp-log gpcli persona-allow personas-show demo-reset-scene12)

install_helpers_to() {
  target="$1"
  for name in "${HELPER_NAMES[@]}"; do
    src="$HELPERS_DIR/$name"
    dst="$target/$name"
    if [ -x "$src" ]; then
      ln -sfn "$src" "$dst" && printf '  symlinked %s\n' "$dst"
    fi
  done
}

log "Installing shell helpers from $HELPERS_DIR"
if [ ! -d "$HELPERS_DIR" ]; then
  printf '  (skip — %s not present)\n' "$HELPERS_DIR"
else
  chmod +x "$HELPERS_DIR"/* 2>/dev/null || true
  if [ -w /opt/homebrew/bin ]; then
    install_helpers_to /opt/homebrew/bin
  elif [ -w /usr/local/bin ]; then
    install_helpers_to /usr/local/bin
  else
    cat <<HINT
  (/usr/local/bin not writable — add helpers to PATH yourself)
  Add to your shell rc (~/.zshrc or ~/.bashrc):

    export PATH="$HELPERS_DIR:\$PATH"

  Or symlink with sudo:

    for f in $HELPERS_DIR/*; do sudo ln -sfn "\$f" /usr/local/bin/; done
HINT
  fi
fi

log "Done."
cat <<EOF

Demo logins (password for all: ${PASSWORD})
  viewer@email.com    role=readonly  → Greenplum readonly_user
  analyst@email.com   role=analyst   → Greenplum analyst_user
  dba@email.com       role=admin     → Greenplum gpadmin

Helper commands now available on PATH:
  mcp                      — interactive shell in MCP server (or 'mcp ls /app')
  mcp-reload               — restart MCP + data-chat services
  mcp-log [N]              — tail MCP server log (default 10 lines)
  gpcli                    — psql as gpadmin against the Greenplum demo cluster
  persona-allow <p> <tool> — add a tool to a persona's allowedTools

Next: if the MCP container was already running before this script, reload it:
  mcp-reload

Then wire Claude Desktop:
  ./claude-mcp-config.sh on
EOF
