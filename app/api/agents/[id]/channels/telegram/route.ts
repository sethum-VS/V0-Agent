import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/agents/[id]/channels/telegram
 * Connect a Telegram bot to the agent
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id: agentId } = await params;

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Telegram bot token required" }, { status: 400 });
  }

  // Validate token format (Telegram bot tokens are "123456:ABC-DEF...")
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid Telegram bot token format" },
      { status: 400 }
    );
  }

  // Verify agent ownership
  const agents = (await sql`
    SELECT user_id, status FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { user_id: string; status: string }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agents[0].user_id !== user.id) {
    return NextResponse.json(
      { error: "Unauthorized: agent does not belong to you" },
      { status: 403 }
    );
  }

  if (agents[0].status !== "online") {
    return NextResponse.json(
      { error: "Agent must be online to connect Telegram" },
      { status: 409 }
    );
  }

  try {
    const now = new Date();

    // Update agent with Telegram token
    await sql`
      UPDATE agents
      SET telegram_bot_token = ${token}, telegram_linked_at = ${now}
      WHERE id = ${agentId}
    `;

    // Insert system command message into queue
    const rows = (await sql`
      INSERT INTO agent_messages (agent_id, role, content)
      VALUES (${agentId}, 'system', ${"SYS_CMD:ENABLE_CHANNEL:TELEGRAM:" + token})
      RETURNING id, created_at
    `) as { id: string; created_at: Date }[];

    return NextResponse.json(
      {
        id: rows[0].id,
        status: "connected",
        linkedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[telegram] Connection error:", error.message);
    return NextResponse.json(
      { error: "Failed to connect Telegram channel" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/channels/telegram
 * Disconnect Telegram from the agent
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id: agentId } = await params;

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  // Verify agent ownership
  const agents = (await sql`
    SELECT user_id, telegram_bot_token FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { user_id: string; telegram_bot_token: string | null }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agents[0].user_id !== user.id) {
    return NextResponse.json(
      { error: "Unauthorized: agent does not belong to you" },
      { status: 403 }
    );
  }

  if (!agents[0].telegram_bot_token) {
    return NextResponse.json(
      { error: "Telegram is not connected to this agent" },
      { status: 409 }
    );
  }

  try {
    // Clear Telegram token from database
    await sql`
      UPDATE agents
      SET telegram_bot_token = NULL, telegram_linked_at = NULL
      WHERE id = ${agentId}
    `;

    // Insert system command message into queue
    await sql`
      INSERT INTO agent_messages (agent_id, role, content)
      VALUES (${agentId}, 'system', 'SYS_CMD:DISABLE_CHANNEL:TELEGRAM')
    `;

    return NextResponse.json({ status: "disconnected" });
  } catch (error: any) {
    console.error("[telegram] Disconnection error:", error.message);
    return NextResponse.json(
      { error: "Failed to disconnect Telegram channel" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/[id]/channels/telegram
 * Get Telegram connection status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id: agentId } = await params;

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  // Verify agent ownership
  const agents = (await sql`
    SELECT telegram_bot_token, telegram_linked_at FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { telegram_bot_token: string | null; telegram_linked_at: Date | null }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = agents[0];

  return NextResponse.json({
    telegram: {
      isConnected: !!agent.telegram_bot_token,
      linkedAt: agent.telegram_linked_at?.toISOString() || null,
    },
  });
}
