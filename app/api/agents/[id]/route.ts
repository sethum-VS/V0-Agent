import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * DELETE /api/agents/[id]
 *
 * Cancels (hard-deletes) an agent that is still in a cancellable state.
 * Only agents with status "provisioning" or "awaiting_connection" may be cancelled.
 * The row is scoped by user_id to prevent cross-user deletion.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing agent id" }, { status: 400 });
  }

  // First verify the agent exists, belongs to this user, and is in a cancellable state
  const rows = (await sql`
    SELECT id, status
    FROM agents
    WHERE id = ${id} AND user_id = ${user.id}
    LIMIT 1
  `) as { id: string; status: string }[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = rows[0];
  const cancellableStatuses = ["provisioning", "awaiting_connection"];

  if (!cancellableStatuses.includes(agent.status)) {
    return NextResponse.json(
      { error: `Agent cannot be cancelled in status: ${agent.status}` },
      { status: 409 }
    );
  }

  await sql`
    DELETE FROM agents
    WHERE id = ${id} AND user_id = ${user.id}
  `;

  return NextResponse.json({ success: true });
}
