import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/agents/[id]/skills/install
 * Queue a skill installation command for the daemon
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id: agentId } = await params;

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  if (!slug) {
    return NextResponse.json({ error: "Skill slug required" }, { status: 400 });
  }

  // Validate slug format (basic check for alphanumeric, dashes, slashes, underscores)
  if (!/^[\w\-/.]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Invalid skill slug format" },
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
      { error: "Agent must be online to install skills" },
      { status: 409 }
    );
  }

  try {
    // Insert system command message into queue
    const rows = (await sql`
      INSERT INTO agent_messages (agent_id, role, content)
      VALUES (${agentId}, 'system', ${"SYS_CMD:INSTALL_SKILL:" + slug})
      RETURNING id, created_at
    `) as { id: string; created_at: Date }[];

    return NextResponse.json(
      {
        id: rows[0].id,
        status: "installing",
        slug,
        createdAt: rows[0].created_at,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[skills] Installation queue error:", error.message);
    return NextResponse.json(
      { error: "Failed to queue skill installation" },
      { status: 500 }
    );
  }
}
