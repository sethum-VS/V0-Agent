import { NextResponse } from "next/server";

export async function GET() {
  // Resolve the base URL for the API endpoint and binary download.
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const script = `#!/bin/bash
set -euo pipefail

echo "Welcome to OpenClaw"
echo ""

# 1. Detect Mac architecture and pick the matching binary
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BINARY_NAME="openclaw-mac"
elif [ "$ARCH" = "x86_64" ]; then
  BINARY_NAME="openclaw-mac-x64"
else
  echo "Unsupported architecture: $ARCH (only arm64 and x86_64 are supported)"
  exit 1
fi

DOWNLOAD_URL="${baseUrl}/$BINARY_NAME"
INSTALL_PATH="/usr/local/bin/openclaw"

# 2. Ask for the Link Command
echo "Paste the 'Awaiting Link' command from your OpenClaw Dashboard:"
read -p "> " LINK_COMMAND

# 3. Extract the Agent ID
AGENT_ID=$(echo "$LINK_COMMAND" | grep -oE 'agent-id [^ ]+' | awk '{print $2}')
if [ -z "$AGENT_ID" ]; then
  echo "Invalid link command. Make sure you copied the full command."
  exit 1
fi

echo "Linking Agent $AGENT_ID to this Mac..."

# 4. Download the precompiled binary
echo "Downloading openclaw binary from $DOWNLOAD_URL ..."
TMP_BINARY=$(mktemp)
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_BINARY"

# 5. Install with executable permissions
chmod +x "$TMP_BINARY"
if [ -w "$(dirname "$INSTALL_PATH")" ]; then
  mv "$TMP_BINARY" "$INSTALL_PATH"
else
  echo "Elevated permissions required to install to $INSTALL_PATH"
  sudo mv "$TMP_BINARY" "$INSTALL_PATH"
fi

# 6. Launch the daemon detached, in managed mode
echo "Booting background daemon..."
mkdir -p "$HOME/.openclaw"
LOG_FILE="$HOME/.openclaw/daemon.log"
nohup "$INSTALL_PATH" --managed "$AGENT_ID" --endpoint "${baseUrl}/api/agents" \\
  >> "$LOG_FILE" 2>&1 &
disown || true

echo ""
echo "OpenClaw is now running silently in the background."
echo "Logs: $LOG_FILE"
echo "Open your dashboard to confirm the agent is online."
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": "inline; filename=install.sh",
    },
  });
}
