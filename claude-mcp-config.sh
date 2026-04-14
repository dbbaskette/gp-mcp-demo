#!/usr/bin/env bash
# claude-mcp-config on|off  — toggles the gp-mcp server in Claude Desktop and restarts it.
set -euo pipefail

CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
SERVER_NAME="gp-mcp"
URL="https://localhost/mcp"
CA_PATH="$HOME/Library/Application Support/mkcert/rootCA.pem"

usage() { echo "usage: $(basename "$0") on|off"; exit 1; }
[[ $# -eq 1 ]] || usage

case "$1" in
  on)  mode=on ;;
  off) mode=off ;;
  *)   usage ;;
esac

command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[[ -f "$CONFIG" ]] || echo '{"mcpServers":{}}' > "$CONFIG"

tmp=$(mktemp)
if [[ "$mode" == "on" ]]; then
  jq --arg name "$SERVER_NAME" --arg url "$URL" --arg ca "$CA_PATH" '
    .mcpServers = (.mcpServers // {}) |
    .mcpServers[$name] = {
      command: "npx",
      args: ["-y", "mcp-remote@latest", $url],
      env: { NODE_EXTRA_CA_CERTS: $ca }
    }
  ' "$CONFIG" > "$tmp"
  echo "Enabled $SERVER_NAME → $URL"
else
  jq --arg name "$SERVER_NAME" '
    .mcpServers = (.mcpServers // {}) |
    del(.mcpServers[$name])
  ' "$CONFIG" > "$tmp"
  echo "Disabled $SERVER_NAME"
fi
mv "$tmp" "$CONFIG"

echo "Restarting Claude Desktop..."
osascript -e 'quit app "Claude"' 2>/dev/null || true
# wait for it to fully exit
for _ in {1..20}; do
  pgrep -x "Claude" >/dev/null || break
  sleep 0.5
done
open -a "Claude"
echo "Done."
