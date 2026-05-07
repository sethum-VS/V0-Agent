import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

interface SkillStatus {
  slug: string;
  status: "installing" | "installed" | "failed";
  installedAt?: Date;
  error?: string;
}

/**
 * GET /api/agents/[id]/skills
 * Fetch skill installation status for an agent
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

  try {
    // Fetch all skill-related system messages
    const messages = (await sql`
      SELECT id, role, content, created_at, is_read
      FROM agent_messages
      WHERE agent_id = ${agentId} 
        AND role = 'system'
        AND (content LIKE 'SYS_CMD:INSTALL_SKILL:%' OR content LIKE '✅ Successfully installed skill:%' OR content LIKE '❌ Skill installation failed:%')
      ORDER BY created_at DESC
    `) as {
      id: string;
      role: string;
      content: string;
      created_at: Date;
      is_read: boolean;
    }[];

    // Parse skill status from messages
    const skillMap = new Map<string, SkillStatus>();

    for (const msg of messages) {
      if (msg.content.startsWith("SYS_CMD:INSTALL_SKILL:")) {
        const slug = msg.content.split(":").slice(3).join(":");
        if (!skillMap.has(slug)) {
          skillMap.set(slug, {
            slug,
            status: "installing",
          });
        }
      } else if (msg.content.startsWith("✅ Successfully installed skill:")) {
        const slug = msg.content.replace("✅ Successfully installed skill: ", "").trim();
        skillMap.set(slug, {
          slug,
          status: "installed",
          installedAt: msg.created_at,
        });
      } else if (msg.content.startsWith("❌ Skill installation failed:")) {
        const parts = msg.content.split(":");
        const slug = parts[1]?.trim() || "unknown";
        const error = parts.slice(2).join(":").trim();
        skillMap.set(slug, {
          slug,
          status: "failed",
          error,
        });
      }
    }

    const skills = Array.from(skillMap.values());

    return NextResponse.json({ skills });
  } catch (error: any) {
    console.error("[skills] Status fetch error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch skill status" },
      { status: 500 }
    );
  }
}
