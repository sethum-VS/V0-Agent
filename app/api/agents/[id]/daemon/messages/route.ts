import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import type { AgentMessage } from "@/lib/db";

/**
 * GET /api/agents/[id]/daemon/messages
 * Daemon endpoint to fetch unread user messages (no auth required, uses agentId as key)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  // Verify agent exists
  const agents = (await sql`
    SELECT id, status FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { id: string; status: string }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Fetch unread user messages for this agent
  const messages = (await sql`
    SELECT id, agent_id, role, content, created_at, is_read
    FROM agent_messages
    WHERE agent_id = ${agentId}
      AND role = 'user'
      AND is_read = false
    ORDER BY created_at ASC
  `) as AgentMessage[];

  return NextResponse.json({ messages });
}

/**
 * POST /api/agents/[id]/daemon/messages
 * Daemon endpoint to post agent responses and mark user messages as read
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  let body: { content?: string; replyToId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const replyToId = typeof body.replyToId === "string" ? body.replyToId : null;

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  // Verify agent exists
  const agents = (await sql`
    SELECT id FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { id: string }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Insert agent response
  const rows = (await sql`
    INSERT INTO agent_messages (agent_id, role, content)
    VALUES (${agentId}, 'agent', ${content})
    RETURNING id, agent_id, role, content, created_at, is_read
  `) as AgentMessage[];

  // Mark the replied-to message as read (if provided)
  if (replyToId) {
    await sql`
      UPDATE agent_messages
      SET is_read = true
      WHERE id = ${replyToId} AND agent_id = ${agentId}
    `;
  }

  return NextResponse.json({ message: rows[0] }, { status: 201 });
}
