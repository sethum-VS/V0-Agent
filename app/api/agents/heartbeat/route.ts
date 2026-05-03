import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { Agent } from "@/lib/db";

/**
 * POST /api/agents/heartbeat
 *
 * Called periodically by the running OpenClaw daemon to signal liveness.
 * Verifies the agentId + machineId pair (set during sync), updates
 * last_heartbeat and ensures status remains 'online'.
 *
 * Body: { agentId: string; machineId: string }
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).agentId !== "string" ||
    typeof (body as Record<string, unknown>).machineId !== "string"
  ) {
    return NextResponse.json(
      { error: "Body must contain agentId (string) and machineId (string)" },
      { status: 400 },
    );
  }

  const { agentId, machineId } = body as { agentId: string; machineId: string };

  const agents = await sql<Agent[]>`
    SELECT id, machine_id, status FROM agents WHERE id = ${agentId} LIMIT 1
  `;

  if (agents.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = agents[0];

  // Verify machine ID matches the one registered during sync
  if (agent.machine_id !== machineId) {
    return NextResponse.json(
      { error: "Machine ID mismatch — run sync first" },
      { status: 403 },
    );
  }

  await sql`
    UPDATE agents
    SET last_heartbeat = now(),
        status         = 'online',
        updated_at     = now()
    WHERE id = ${agentId}
  `;

  return NextResponse.json({ ok: true, agentId, timestamp: new Date().toISOString() });
}
