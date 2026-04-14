#!/usr/bin/env bash
set -euo pipefail

: "${GPHOST:=greenplum-sne}"
: "${GPPORT:=5432}"
: "${GPUSER:=gpadmin}"
: "${PGPASSWORD:=VMware1!}"
: "${DATABASE:=tpcds}"
: "${TPCDS_DIR:=/tpcds}"
export PGPASSWORD

PSQL="psql -h $GPHOST -p $GPPORT -U $GPUSER"

echo "Waiting for Greenplum at $GPHOST:$GPPORT ..."
for _ in $(seq 1 60); do
  $PSQL -d postgres -tAc "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
done
$PSQL -d postgres -tAc "SELECT 1" >/dev/null

if $PSQL -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DATABASE'" | grep -q 1; then
  COUNT=$($PSQL -d "$DATABASE" -tAc "SELECT COALESCE((SELECT count(*) FROM store_sales), 0)" 2>/dev/null || echo 0)
  if [ "${COUNT:-0}" -gt 0 ]; then
    echo "tpcds already loaded ($COUNT store_sales rows) — skipping."
    exit 0
  fi
else
  echo "Creating database $DATABASE ..."
  $PSQL -d postgres -c "CREATE DATABASE $DATABASE"
fi

echo "Loading schema ..."
$PSQL -d "$DATABASE" -f "$TPCDS_DIR/tpcds_schema.sql"

TABLES="call_center catalog_page catalog_returns catalog_sales customer customer_address customer_demographics date_dim dbgen_version household_demographics income_band inventory item promotion reason ship_mode store store_returns store_sales time_dim warehouse web_page web_returns web_sales web_site"

for t in $TABLES; do
  src="$TPCDS_DIR/data/${t}.dat"
  if [ ! -f "$src" ]; then
    # try combining parallel shards
    shopt -s nullglob
    shards=("$TPCDS_DIR/data/${t}"_[0-9]*_[0-9]*.dat)
    shopt -u nullglob
    if [ ${#shards[@]} -gt 0 ]; then
      cat "${shards[@]}" > "$src"
    else
      echo "  skip $t (no data)"; continue
    fi
  fi
  clean="/tmp/${t}.dat"
  sed 's/|$//' "$src" > "$clean"
  rows=$(wc -l < "$clean" | tr -d ' ')
  echo "  loading $t ($rows rows) ..."
  $PSQL -d "$DATABASE" -c "\\COPY $t FROM '$clean' WITH (FORMAT csv, DELIMITER '|', NULL '')" >/dev/null
  rm -f "$clean"
done

echo "Analyzing ..."
$PSQL -d "$DATABASE" -c "ANALYZE" >/dev/null
echo "tpcds load complete."
