import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { Agent } from "@/lib/db";

/**
 * POST /api/agents/sync
 *
 * Called by the local OpenClaw daemon on first boot.
 * Authenticates by agent ID, registers the machine ID, marks agent online,
 * and returns the SOUL.md config and mocked API tokens the daemon needs.
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
    SELECT * FROM agents WHERE id = ${agentId} LIMIT 1
  `;

  if (agents.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = agents[0];

  // Register machine and transition to online
  await sql`
    UPDATE agents
    SET machine_id   = ${machineId},
        status       = 'online',
        last_heartbeat = now(),
        updated_at   = now()
    WHERE id = ${agentId}
  `;

  // Return soul config and mocked bootstrap tokens for the daemon
  return NextResponse.json({
    agentId: agent.id,
    soulConfig: agent.soul_config ?? "",
    tokens: {
      // Mocked tokens — replace with real secrets when available
      botRegistrationId: `bot_${agent.id.replace(/-/g, "").slice(0, 16)}`,
      messagingToken: `msg_${Buffer.from(agentId).toString("base64url").slice(0, 24)}`,
      webhookSecret: `whsec_${Buffer.from(machineId + agentId).toString("base64url").slice(0, 32)}`,
    },
  });
}
