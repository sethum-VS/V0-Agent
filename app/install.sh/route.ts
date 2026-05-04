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
ENDPOINT="${baseUrl}/api/agents"
OPENCLAW_DIR="$HOME/.openclaw"
LOG_FILE="$OPENCLAW_DIR/daemon.log"

echo "Installing OpenClaw for Agent $AGENT_ID..."

# 1. Check for Bun (required runtime)
if ! command -v bun &> /dev/null; then
  echo "Bun is not installed. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# 2. Create openclaw directory and clone/update daemon
mkdir -p "$OPENCLAW_DIR"
cd "$OPENCLAW_DIR"

if [ -d "daemon" ]; then
  echo "Updating OpenClaw daemon..."
  cd daemon && git pull --quiet 2>/dev/null || true
else
  echo "Downloading OpenClaw daemon..."
  git clone --depth 1 https://github.com/openclaw/openclaw.git daemon 2>/dev/null || {
    # Fallback: create minimal managed daemon inline
    mkdir -p daemon/src
    cat > daemon/package.json << 'PKGJSON'
{
  "name": "openclaw-daemon",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "bun run src/index.ts" }
}
PKGJSON
    cat > daemon/src/index.ts << 'DAEMONTS'
const args = process.argv.slice(2);
const agentIdIdx = args.indexOf("--managed");
const endpointIdx = args.indexOf("--endpoint");
const agentId = agentIdIdx !== -1 ? args[agentIdIdx + 1] : null;
const endpoint = endpointIdx !== -1 ? args[endpointIdx + 1] : null;

if (!agentId || !endpoint) {
  console.error("Usage: bun run src/index.ts --managed <agentId> --endpoint <url>");
  process.exit(1);
}

console.log("[openclaw] Starting managed daemon for agent:", agentId);

// Sync with server
const syncRes = await fetch(endpoint + "/sync", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ agentId }),
});
if (!syncRes.ok) {
  console.error("[openclaw] Sync failed:", syncRes.status);
  process.exit(1);
}
const config = await syncRes.json();
console.log("[openclaw] Synced. Soul config received.");

// Heartbeat loop
const machineId = require("os").hostname() + "-" + process.pid;
setInterval(async () => {
  try {
    await fetch(endpoint + "/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, machineId }),
    });
    console.log("[openclaw] Heartbeat sent");
  } catch (e) {
    console.error("[openclaw] Heartbeat failed:", e.message);
  }
}, 30000);

// Initial heartbeat
await fetch(endpoint + "/heartbeat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ agentId, machineId }),
});
console.log("[openclaw] Daemon online. Listening for messages...");

// Keep alive
setInterval(() => {}, 1000);
DAEMONTS
  }
  cd daemon
fi

# 3. Install dependencies
echo "Installing dependencies..."
bun install --silent 2>/dev/null || true

# 4. Launch the daemon detached
echo "Booting background daemon..."
nohup bun run src/index.ts --managed "$AGENT_ID" --endpoint "$ENDPOINT" >> "$LOG_FILE" 2>&1 &
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
