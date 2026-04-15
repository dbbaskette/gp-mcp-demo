#!/usr/bin/env bash
# claude-mcp-config on|off|relogin
#   on       — register gp-mcp in Claude Desktop and restart it
#   off      — remove it and restart
#   relogin  — clear cached MCP OAuth tokens so you can log in as a different
#              FeauxAuth user on next connect (used between demo segments)
set -euo pipefail

CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
SERVER_NAME="gp-mcp"
URL="https://localhost/mcp"
CA_PATH="$HOME/Library/Application Support/mkcert/rootCA.pem"

usage() { echo "usage: $(basename "$0") on|off|relogin"; exit 1; }
[[ $# -eq 1 ]] || usage

case "$1" in
  on)      mode=on ;;
  off)     mode=off ;;
  relogin) mode=relogin ;;
  *)       usage ;;
esac

restart_claude() {
  echo "Stopping Claude Desktop..."
  # Kill the main app and any helper/renderer/mcp-remote children.
  pkill -f "/Claude.app/Contents/MacOS/Claude" 2>/dev/null || true
  pkill -f "Claude Helper" 2>/dev/null || true
  pkill -f "mcp-remote" 2>/dev/null || true
  for _ in {1..20}; do
    pgrep -f "/Claude.app/Contents/MacOS/Claude" >/dev/null || break
    sleep 0.5
  done
  if pgrep -f "/Claude.app/Contents/MacOS/Claude" >/dev/null; then
    echo "  forcing..."
    pkill -9 -f "/Claude.app/Contents/MacOS/Claude" 2>/dev/null || true
    sleep 1
  fi
  echo "Starting Claude Desktop..."
  open -a "Claude"
}

if [[ "$mode" == "relogin" ]]; then
  echo "Clearing cached MCP OAuth tokens in ~/.mcp-auth ..."
  rm -rf "$HOME/.mcp-auth"/* 2>/dev/null || true
  restart_claude
  echo "Next MCP request will re-open the FeauxAuth login in your browser."
  exit 0
fi

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

restart_claude
echo "Done."
