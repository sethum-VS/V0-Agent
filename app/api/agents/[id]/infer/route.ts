import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateText } from "ai";

/**
 * POST /api/agents/[id]/infer
 * Server-side AI inference endpoint for daemon to call
 * Uses Vercel AI Gateway to route to the configured model provider
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
  
  console.log(`[infer] Initializing for agent: ${agentId}`);
  console.log(`[infer] Provider type: ${agent.model_provider_type}`);

  // Build system prompt from soul config or task description
  const systemPrompt = soulConfig || agent.soul_config || `You are an AI assistant. Your task: ${taskDescription || agent.task_description}

Be helpful, concise, and professional in your responses.`;

  // Fetch recent message history for context (last 5 messages for efficiency)
  const history = (await sql`
    SELECT role, content
    FROM agent_messages
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT 5
  `) as { role: string; content: string }[];

  // Build messages array (reverse to get chronological order)
  // Map database role names to AI SDK role names: "agent" -> "assistant"
  const messages = history.reverse().map(m => ({
    role: m.role === "agent" ? ("assistant" as const) : (m.role as "user"),
    content: m.content,
  }));

  // Add the current message
  messages.push({ role: "user", content: message });

  // Use Gemini 2.5 Flash for demo-ai provider, OpenAI for system/byok
  // The "google/gemini-2-flash" model ID routes through the Vercel AI Gateway
  // to Google's models when AI_GATEWAY_API_KEY is configured
  const modelId = agent.model_provider_type === "demo-ai" 
    ? "google/gemini-2-flash"
    : "openai/gpt-4o-mini";

  console.log(`[infer] Using model: ${modelId}`);
  console.log(`[infer] Message count: ${messages.length}`);

  try {
    // AI SDK 6: pass model as plain string — Vercel AI Gateway handles routing
    const result = await generateText({
      model: modelId,
      system: systemPrompt,
      messages,
    });

    console.log(`[infer] Success: generated ${result.text.length} characters`);
    return NextResponse.json({ response: result.text });
  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      cause: error.cause,
      status: error.status,
      stack: error.stack?.split('\n')[0],
    };
    
    console.error(`[infer] Inference failed:`, {
      agentId,
      model: modelId,
      error: errorDetails,
      messageLength: message.length,
      historyCount: history.length,
    });
    
    return NextResponse.json(
      { 
        error: "AI inference failed", 
        details: error.message,
        hint: "Verify AI_GATEWAY_API_KEY is set and the model provider is configured correctly"
      },
      { status: 500 }
    );
  }
}
