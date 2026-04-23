# Runtime for the pre-built Greenplum MCP server binary.
#
# The binary itself ships linux/amd64 only (statically linked) and is
# bind-mounted from ../Tanzu-GP-MCP-Server/ via docker-compose. This image
# just provides the base OS plus the shell-out tools the server invokes:
#
#   - openssh-client  → ssh/scp, used by GPDB_GPHOSTSSH* diagnostics
#   - ca-certificates → TLS trust anchors for outbound HTTPS (JWKS, etc.)
#
# On Apple Silicon Docker Desktop runs this under Rosetta transparently
# (docker-compose sets platform: linux/amd64 on the service).
FROM debian:stable-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
