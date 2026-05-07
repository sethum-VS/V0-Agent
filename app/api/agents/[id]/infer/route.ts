import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateText } from "ai";

/**
 * POST /api/agents/[id]/infer
 * Server-side AI inference endpoint for daemon to call
 * This runs on the server where AI Gateway credentials are available
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  let body: { message?: string; soulConfig?: string; taskDescription?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const soulConfig = typeof body.soulConfig === "string" ? body.soulConfig : "";
  const taskDescription = typeof body.taskDescription === "string" ? body.taskDescription : "";

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Verify agent exists and get its config
  const agents = (await sql`
    SELECT id, task_description, soul_config, model_provider_type, encrypted_api_key
    FROM agents WHERE id = ${agentId} LIMIT 1
  `) as { 
    id: string; 
    task_description: string; 
    soul_config: string | null;
    model_provider_type: string;
    encrypted_api_key: string | null;
  }[];

  if (!agents.length) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = agents[0];

  // Build system prompt from soul config or task description
  const systemPrompt = soulConfig || agent.soul_config || `You are an AI assistant. Your task: ${taskDescription || agent.task_description}

Be helpful, concise, and professional in your responses.`;

  // Fetch recent message history for context
  const history = (await sql`
    SELECT role, content
    FROM agent_messages
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT 10
  `) as { role: string; content: string }[];

  // Build messages array (reverse to get chronological order)
  const messages = history.reverse().map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Add the current message
  messages.push({ role: "user", content: message });

  try {
    // AI SDK 6: pass model as plain string — Vercel AI Gateway handles routing
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages,
    });

    return NextResponse.json({ response: result.text });
  } catch (error: any) {
    console.error("[infer] AI generation error:", error.message, error.stack);
    return NextResponse.json(
      { error: "AI inference failed", details: error.message },
      { status: 500 }
    );
  }
}
