import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/agents/[id]/messages/[msgId]/read
 * Mark a message as read (called by the daemon after consuming it)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const user = await requireAuth();
  const { id: agentId, msgId } = await params;

  if (!agentId || !msgId) {
    return NextResponse.json(
      { error: "Missing agentId or msgId" },
      { status: 400 }
    );
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
      { error: "Unauthorized" },
      { status: 403 }
    );
  }

  // Mark message as read
  await sql`
    UPDATE agent_messages
    SET is_read = true
    WHERE id = ${msgId} AND agent_id = ${agentId}
  `;

  return NextResponse.json({ success: true });
}
