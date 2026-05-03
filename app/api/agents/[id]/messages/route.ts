import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { AgentMessage } from "@/lib/db";

/**
 * GET /api/agents/[id]/messages
 * Fetch all messages for an agent (with ownership verification)
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
    SELECT user_id FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { user_id: string }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agents[0].user_id !== user.id) {
    return NextResponse.json(
      { error: "Unauthorized: agent does not belong to you" },
      { status: 403 }
    );
  }

  // Fetch all messages for this agent
  const messages = (await sql`
    SELECT id, agent_id, role, content, created_at, is_read
    FROM agent_messages
    WHERE agent_id = ${agentId}
    ORDER BY created_at ASC
  `) as AgentMessage[];

  return NextResponse.json({ messages });
}

/**
 * POST /api/agents/[id]/messages
 * Send a message to an agent
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id: agentId } = await params;

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  // Verify agent ownership and status
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
      { error: "Agent is not online" },
      { status: 409 }
    );
  }

  // Insert user message
  const rows = (await sql`
    INSERT INTO agent_messages (agent_id, role, content)
    VALUES (${agentId}, 'user', ${content})
    RETURNING id, agent_id, role, content, created_at, is_read
  `) as AgentMessage[];

  return NextResponse.json({ message: rows[0] }, { status: 201 });
}
