#!/usr/bin/env bash
# Runs inside a Docker container to create:
#   1. Greenplum roles + grants (readonly_user, analyst_user)
#   2. FeauxAuth demo login users (viewer, analyst, dba)
# All passwords default to "password".
set -euo pipefail

PASSWORD="${DEMO_PASSWORD:-password}"

GP_HOST="${GPHOST:-greenplum-sne}"
GP_PORT="${GPPORT:-5432}"
GP_USER="${GPUSER:-gpadmin}"
GP_DB="${DATABASE:-tpcds}"

FEAUXAUTH_URL="${FEAUXAUTH_URL:-https://feauxauth:8443}"
FEAUXAUTH_ADMIN_USER="${FEAUXAUTH_ADMIN_USER:-admin}"
FEAUXAUTH_ADMIN_PASS="${FEAUXAUTH_ADMIN_PASS:-feauxauth}"

log() { printf '\n==> %s\n' "$*"; }

# --- Greenplum ----------------------------------------------------------------

log "Creating Greenplum roles + grants (host=$GP_HOST db=$GP_DB)"

psql -h "$GP_HOST" -p "$GP_PORT" -U "$GP_USER" -d "$GP_DB" \
     -v ON_ERROR_STOP=1 <<SQL
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

-- readonly: narrow slice of tpcds (viewer persona scope)
GRANT SELECT ON customer, store_sales, item, date_dim TO readonly_user;
SQL

log "Greenplum roles ready: readonly_user, analyst_user"

# --- FeauxAuth ----------------------------------------------------------------

log "Waiting for FeauxAuth at ${FEAUXAUTH_URL} ..."
for _ in $(seq 1 60); do
  if curl -sk -o /dev/null -w '%{http_code}' \
       "${FEAUXAUTH_URL}/.well-known/openid-configuration" | grep -q '^200$'; then
    break
  fi
  sleep 2
done

USERS_JSON=""

refresh_users_cache() {
  USERS_JSON=$(curl -sk -u "${FEAUXAUTH_ADMIN_USER}:${FEAUXAUTH_ADMIN_PASS}" \
    "${FEAUXAUTH_URL}/api/admin/users")
}

user_exists() {
  printf '%s' "$USERS_JSON" | grep -Fq "\"email\":\"$1\""
}

create_feauxauth_user() {
  local email="$1" display="$2" roles="$3"
  if user_exists "$email"; then
    echo "  exists  $email — skipping"
    return 0
  fi
  local body http
  body="{\"email\":\"${email}\",\"displayName\":\"${display}\",\"password\":\"${PASSWORD}\",\"roles\":\"${roles}\"}"
  http=$(curl -sk -o /tmp/fa-resp -w '%{http_code}' \
    -u "${FEAUXAUTH_ADMIN_USER}:${FEAUXAUTH_ADMIN_PASS}" \
    -H 'Content-Type: application/json' \
    -X POST "${FEAUXAUTH_URL}/api/admin/users" \
    -d "$body")
  case "$http" in
    200|201) echo "  created $email ($roles)";;
    *)       echo "  FAILED  $email (HTTP $http):"; cat /tmp/fa-resp; echo; exit 1;;
  esac
  rm -f /tmp/fa-resp
}

log "Creating FeauxAuth users (password=$PASSWORD)"
refresh_users_cache
create_feauxauth_user "viewer@email.com"  "Demo Viewer"  "readonly"
create_feauxauth_user "analyst@email.com" "Demo Analyst" "analyst"
create_feauxauth_user "dba@email.com"     "Demo DBA"     "admin"

log "Demo users ready."
cat <<EOF

Demo logins (password: ${PASSWORD})
  viewer@email.com    role=readonly  → Greenplum readonly_user
  analyst@email.com   role=analyst   → Greenplum analyst_user
  dba@email.com       role=admin     → Greenplum gpadmin

EOF
