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

echo "Installing OpenClaw Agent Daemon for Agent $AGENT_ID..."

# 1. Detect runtime: prefer Node (recommended), fall back to Bun
RUNTIME=""
RUNTIME_PATH=""

# Check for Node 22+
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -e "console.log(process.version.replace('v','').split('.')[0])" 2>/dev/null || echo "0")
  if [ "$NODE_VERSION" -ge 22 ] 2>/dev/null; then
    RUNTIME="node"
    RUNTIME_PATH=$(which node)
    echo "Using Node.js $(node --version) at: $RUNTIME_PATH"
  fi
fi

# Fall back to Bun if Node not available
if [ -z "$RUNTIME" ]; then
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun &> /dev/null; then
    echo "Installing Bun runtime..."
    curl -fsSL https://bun.sh/install | bash
    source "$HOME/.bashrc" 2>/dev/null || source "$HOME/.zshrc" 2>/dev/null || true
  fi
  BUN_PATH="$BUN_INSTALL/bin/bun"
  if [ ! -f "$BUN_PATH" ]; then
    BUN_PATH=$(which bun 2>/dev/null || echo "")
  fi
  if [ -n "$BUN_PATH" ] && [ -f "$BUN_PATH" ]; then
    RUNTIME="bun"
    RUNTIME_PATH="$BUN_PATH"
    echo "Using Bun at: $RUNTIME_PATH"
  else
    echo "Error: No suitable runtime found. Please install Node 22+ or Bun."
    exit 1
  fi
fi

# 2. Create openclaw directory and daemon
mkdir -p "$OPENCLAW_DIR/daemon/src"
cd "$OPENCLAW_DIR/daemon"

# Always write fresh daemon files to ensure latest version
cat > package.json << 'PKGJSON'
{
  "name": "openclaw-daemon",
  "version": "1.0.0",
  "type": "commonjs"
}
PKGJSON

cat > src/index.js << 'DAEMONJS'
const { hostname } = require("os");

const args = process.argv.slice(2);
const agentIdIdx = args.indexOf("--managed");
const endpointIdx = args.indexOf("--endpoint");
const agentId = agentIdIdx !== -1 ? args[agentIdIdx + 1] : null;
const endpoint = endpointIdx !== -1 ? args[endpointIdx + 1] : null;

if (!agentId || !endpoint) {
  console.error("Usage: bun run src/index.ts --managed <agentId> --endpoint <url>");
  process.exit(1);
}

const machineId = hostname() + "-" + process.pid;

console.log("[openclaw] Starting managed daemon for agent:", agentId);
console.log("[openclaw] Machine ID:", machineId);
console.log("[openclaw] Endpoint:", endpoint);

async function main() {
  // Sync with server (include machineId)
  console.log("[openclaw] Syncing with server...");
  const syncRes = await fetch(endpoint + "/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, machineId }),
  });
  if (!syncRes.ok) {
    const errText = await syncRes.text();
    console.error("[openclaw] Sync failed:", syncRes.status, errText);
    process.exit(1);
  }
  const config = await syncRes.json();
  const soulConfig = config.soulConfig || "";
  const taskDescription = config.taskDescription || "You are a helpful AI assistant.";
  console.log("[openclaw] Synced successfully.");

  // Initial heartbeat
  const hbRes = await fetch(endpoint + "/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, machineId }),
  });
  if (hbRes.ok) {
    console.log("[openclaw] Initial heartbeat OK.");
  } else {
    console.error("[openclaw] Initial heartbeat failed:", hbRes.status);
  }

  console.log("[openclaw] Daemon online. Polling for messages every 5s...");

  // AI response via server inference endpoint with retry logic
  async function generateResponse(userMessage) {
    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[openclaw] Inference attempt ${attempt}/${maxRetries} for: ${userMessage.slice(0, 50)}`);
        const res = await fetch(endpoint + "/" + agentId + "/infer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, soulConfig, taskDescription }),
        });
        
        if (res.ok) {
          const data = await res.json();
          const response = data.response || "No response generated.";
          console.log(`[openclaw] Inference success on attempt ${attempt}`);
          return response;
        }

        const errData = await res.json().catch(() => ({}));
        lastError = `HTTP ${res.status}: ${errData.details || errData.error || "unknown error"}`;
        console.error(`[openclaw] Inference attempt ${attempt} failed: ${lastError}`);

        if (attempt < maxRetries) {
          console.log(`[openclaw] Retrying in 2 seconds...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        lastError = e.message;
        console.error(`[openclaw] Inference attempt ${attempt} network error: ${lastError}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    console.error(`[openclaw] Inference failed after ${maxRetries} attempts: ${lastError}`);
    return `I encountered an error generating a response: ${lastError}`;
  }

  // Message polling loop with error recovery
  let pollErrorCount = 0;
  setInterval(async () => {
    try {
      const res = await fetch(endpoint + "/" + agentId + "/daemon/messages");
      if (!res.ok) {
        console.error(`[openclaw] Poll failed: HTTP ${res.status}`);
        pollErrorCount++;
        if (pollErrorCount > 10) {
          console.error("[openclaw] Too many poll failures, check connectivity");
        }
        return;
      }
      
      pollErrorCount = 0; // Reset error count on success
      const data = await res.json();
      const messages = data.messages || [];
      
      if (messages.length > 0) {
        console.log(`[openclaw] Polled: found ${messages.length} unread message(s)`);
      }

      for (const msg of messages) {
        console.log(`[openclaw] Message ${msg.id.slice(0, 8)}: ${msg.content.slice(0, 50).replace(/\n/g, ' ')}...`);
        const response = await generateResponse(msg.content);
        
        await fetch(endpoint + "/" + agentId + "/daemon/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: response, replyToId: msg.id }),
        });
        
        console.log(`[openclaw] Replied with ${response.length} chars`);
      }
    } catch (e) {
      pollErrorCount++;
      console.error(`[openclaw] Poll error (${pollErrorCount}): ${e.message}`);
    }
  }, 5000);

  // Heartbeat loop
  setInterval(async () => {
    try {
      await fetch(endpoint + "/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, machineId }),
      });
    } catch (e) {
      console.error("[openclaw] Heartbeat error:", e.message);
    }
  }, 30000);
}

main().catch((e) => {
  console.error("[openclaw] Fatal error:", e.message);
  process.exit(1);
});

process.on("SIGINT", () => { console.log("[openclaw] Shutting down..."); process.exit(0); });
DAEMONJS

# 3. Launch the daemon detached using detected runtime
echo "Booting background daemon using $RUNTIME..."
nohup "$RUNTIME_PATH" src/index.js --managed "$AGENT_ID" --endpoint "$ENDPOINT" >> "$LOG_FILE" 2>&1 &
disown || true

# Give it a moment to start
sleep 2

echo ""
echo "OpenClaw is now running in the background."
echo "Logs: $LOG_FILE"
echo ""
echo "Checking daemon status..."
if pgrep -f "openclaw-daemon" > /dev/null || pgrep -f "$AGENT_ID" > /dev/null; then
  echo "Daemon process is running."
else
  echo "Note: Daemon may still be starting. Check logs if dashboard doesn't update."
fi
echo ""
echo "Open your dashboard to confirm the agent is online."
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": "inline; filename=install.sh",
    },
  });
}
