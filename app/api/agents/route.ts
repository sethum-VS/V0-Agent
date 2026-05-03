import { NextResponse } from "next/server";
import { sql, type Agent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/agents
 *
 * Fetches all agents for the currently authenticated user.
 * Returns 401 if not authenticated.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const agents = await sql<Agent[]>`
    SELECT 
      id,
      user_id,
      name,
      task_description,
      soul_config,
      status,
      machine_id,
      last_heartbeat,
      created_at,
      updated_at
    FROM agents
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ agents });
}
