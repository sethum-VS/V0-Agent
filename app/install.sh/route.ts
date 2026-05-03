import { NextResponse } from "next/server";

export async function GET() {
  // Resolve the base URL for the API endpoint
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const script = `#!/bin/bash
echo "Welcome to OpenClaw"
echo "Checking system requirements..."

# 1. Check for Docker (Mac requirement)
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed or not running. Please install Docker Desktop for Mac and try again."
    exit 1
fi

echo "Docker found."

# 2. Ask for the Link Command
echo ""
echo "Please paste your 'Awaiting Link' command from your OpenClaw Dashboard:"
read -p "> " LINK_COMMAND

# 3. Extract the Agent ID (basic regex/parsing)
AGENT_ID=$(echo $LINK_COMMAND | grep -o 'agent-id [^ ]*' | awk '{print $2}')

if [ -z "$AGENT_ID" ]; then
    echo "Invalid link command. Make sure you copied the full command."
    exit 1
fi

echo "Linking Agent $AGENT_ID to this Mac..."

# 4. Create local config directory quietly
mkdir -p ~/.openclaw/config_$AGENT_ID

# 5. Run the daemon silently in the background (Detached mode -d)
echo "Booting background daemon..."
docker run -d --restart unless-stopped --name openclaw_$AGENT_ID \\
  -v ~/.openclaw/config_$AGENT_ID:/app/config \\
  -e AGENT_ID=$AGENT_ID \\
  -e ENDPOINT_URL="${baseUrl}/api/agents" \\
  openclaw/daemon:latest

echo ""
echo "OpenClaw is now running silently in the background!"
echo "You can close this terminal. Check your web dashboard to see the system come online."
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": "inline; filename=install.sh",
    },
  });
}
