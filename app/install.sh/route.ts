import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Resolve the base URL for the API endpoint.
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Parse agentId from query params
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");

  // If no agentId, return error
  if (!agentId) {
    const errorScript = `#!/bin/bash
echo "❌ Error: Missing agentId in the installation URL."
echo ""
echo "Usage: curl -fsSL 'https://example.com/install.sh?agentId=YOUR_AGENT_ID' | bash"
exit 1
`;
    return new NextResponse(errorScript, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": "inline; filename=install.sh",
      },
    });
  }

  const script = `#!/bin/bash
set -euo pipefail

echo "Welcome to OpenClaw"
echo ""

# Agent ID injected from install URL
AGENT_ID="${agentId}"

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

echo "Installing OpenClaw for Agent $AGENT_ID..."

# 2. Download the precompiled binary
echo "Downloading openclaw binary from $DOWNLOAD_URL ..."
TMP_BINARY=$(mktemp)
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_BINARY"

# 3. Install with executable permissions
chmod +x "$TMP_BINARY"
if [ -w "$(dirname "$INSTALL_PATH")" ]; then
  mv "$TMP_BINARY" "$INSTALL_PATH"
else
  echo "Elevated permissions required to install to $INSTALL_PATH"
  sudo mv "$TMP_BINARY" "$INSTALL_PATH"
fi

# 4. Launch the daemon detached, in managed mode
echo "Booting background daemon..."
mkdir -p "$HOME/.openclaw"
LOG_FILE="$HOME/.openclaw/daemon.log"
nohup "$INSTALL_PATH" --managed "$AGENT_ID" --endpoint "${baseUrl}/api/agents" \\
  >> "$LOG_FILE" 2>&1 &
disown || true

echo ""
echo "✓ OpenClaw is now running silently in the background."
echo "✓ Logs: $LOG_FILE"
echo "✓ Open your dashboard to confirm the agent is online."
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": "inline; filename=install.sh",
    },
  });
}
