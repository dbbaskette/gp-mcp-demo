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
create_feauxauth_user "viewer@feauxauth.local"  "Demo Viewer"  "readonly"
create_feauxauth_user "analyst@feauxauth.local" "Demo Analyst" "analyst"
create_feauxauth_user "dba@feauxauth.local"     "Demo DBA"     "admin"

log "Done."
cat <<EOF

Demo logins (password for all: ${PASSWORD})
  viewer@feauxauth.local    role=readonly  → Greenplum readonly_user
  analyst@feauxauth.local   role=analyst   → Greenplum analyst_user
  dba@feauxauth.local       role=admin     → Greenplum gpadmin

Next: if the MCP container was already running before this script, reload it
so it picks up any permission_levels changes:
  docker compose restart mcp

Then wire Claude Desktop:
  ./claude-mcp-config.sh on
EOF
