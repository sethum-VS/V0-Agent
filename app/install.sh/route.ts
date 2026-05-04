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

# Ensure Bun path is always available
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "Installing OpenClaw for Agent $AGENT_ID..."

# 1. Check for Bun (required runtime)
if ! command -v bun &> /dev/null; then
  echo "Bun is not installed. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  # Source the updated PATH
  source "$HOME/.bashrc" 2>/dev/null || source "$HOME/.zshrc" 2>/dev/null || true
fi

# Verify bun is available
BUN_PATH="$BUN_INSTALL/bin/bun"
if [ ! -f "$BUN_PATH" ]; then
  BUN_PATH=$(which bun 2>/dev/null || echo "")
fi
if [ -z "$BUN_PATH" ] || [ ! -f "$BUN_PATH" ]; then
  echo "Error: Bun installation failed. Please install Bun manually: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

echo "Using Bun at: $BUN_PATH"

# 2. Create openclaw directory and daemon
mkdir -p "$OPENCLAW_DIR/daemon/src"
cd "$OPENCLAW_DIR/daemon"

# Always write fresh daemon files to ensure latest version
cat > package.json << 'PKGJSON'
{
  "name": "openclaw-daemon",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "bun run src/index.ts" }
}
PKGJSON

cat > src/index.ts << 'DAEMONTS'
import { hostname } from "os";

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
const config = await syncRes.json() as { soulConfig?: string; taskDescription?: string };
const soulConfig = config.soulConfig || "";
const taskDescription = config.taskDescription || "You are a helpful AI assistant.";
console.log("[openclaw] Synced successfully. Soul config received.");

// Initial heartbeat
console.log("[openclaw] Sending initial heartbeat...");
const hbRes = await fetch(endpoint + "/heartbeat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ agentId, machineId }),
});
if (hbRes.ok) {
  console.log("[openclaw] Initial heartbeat sent successfully.");
} else {
  console.error("[openclaw] Initial heartbeat failed:", hbRes.status);
}

console.log("[openclaw] Daemon online. Starting loops...");

// Simple AI response using server-side inference endpoint
async function generateResponse(userMessage: string): Promise<string> {
  try {
    // Call the server's inference endpoint which handles AI
    const res = await fetch(endpoint + "/" + agentId + "/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, soulConfig, taskDescription }),
    });
    if (res.ok) {
      const data = await res.json() as { response: string };
      return data.response;
    } else {
      console.error("[openclaw] Inference failed:", res.status);
      return "I apologize, but I encountered an error processing your request.";
    }
  } catch (e: any) {
    console.error("[openclaw] Inference error:", e.message);
    return "I apologize, but I'm currently unable to respond. Please try again later.";
  }
}

// Message polling loop (every 5 seconds)
setInterval(async () => {
  try {
    const res = await fetch(endpoint + "/" + agentId + "/daemon/messages");
    if (!res.ok) {
      console.error("[openclaw] Message poll failed:", res.status);
      return;
    }
    const data = await res.json() as { messages: Array<{ id: string; content: string }> };
    
    for (const msg of data.messages) {
      console.log("[openclaw] Processing message:", msg.id, msg.content);
      
      // Generate AI response
      const response = await generateResponse(msg.content);
      
      // Post response back
      await fetch(endpoint + "/" + agentId + "/daemon/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: response, replyToId: msg.id }),
      });
      
      console.log("[openclaw] Replied to message:", msg.id);
    }
  } catch (e: any) {
    console.error("[openclaw] Message loop error:", e.message);
  }
}, 5000);

// Heartbeat loop (every 30 seconds)
setInterval(async () => {
  try {
    const res = await fetch(endpoint + "/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, machineId }),
    });
    if (res.ok) {
      console.log("[openclaw] Heartbeat sent at", new Date().toISOString());
    } else {
      console.error("[openclaw] Heartbeat failed:", res.status);
    }
  } catch (e: any) {
    console.error("[openclaw] Heartbeat error:", e.message);
  }
}, 30000);

// Keep process alive
process.on("SIGINT", () => {
  console.log("[openclaw] Shutting down...");
  process.exit(0);
});
DAEMONTS

# 3. Launch the daemon detached using absolute path to bun
echo "Booting background daemon..."
nohup "$BUN_PATH" run src/index.ts --managed "$AGENT_ID" --endpoint "$ENDPOINT" >> "$LOG_FILE" 2>&1 &
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
