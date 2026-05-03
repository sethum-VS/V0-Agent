"use server";

import { start } from "workflow/api";
import { openclawProvisionWorkflow } from "@/workflows/openclaw-provision";
import { sql } from "@/lib/db";
import type { ModelProviderType } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { encryptKey } from "@/lib/encryption";

export async function startProvisionWorker(
  taskDescription: string,
  modelProviderType: ModelProviderType = "system",
  apiKey?: string
) {
  // Enforce authentication - throws if no user
  const user = await requireAuth();

  const trimmed = taskDescription.trim();
  if (!trimmed) {
    return { ok: false as const, error: "Task description is required." };
  }

  // Validate BYOK requires API key
  if (modelProviderType === "byok" && !apiKey?.trim()) {
    return { ok: false as const, error: "API key is required for BYOK mode." };
  }

  // Generate a human-readable agent name from the task
  const agentName = `Worker-${Date.now().toString(36).toUpperCase()}`;

  // Encrypt the API key using AES-256-GCM if provided
  const encryptedKey = apiKey ? encryptKey(apiKey) : null;

  // Insert the agent record with 'provisioning' status
  const rows = (await sql`
    INSERT INTO agents (user_id, name, task_description, status, model_provider_type, encrypted_api_key)
    VALUES (${user.id}, ${agentName}, ${trimmed}, 'provisioning', ${modelProviderType}, ${encryptedKey})
    RETURNING id
  `) as { id: string }[];
  const agent = rows[0];

  // Start the workflow, passing the agent ID and BYOK info for status updates
  const run = await start(openclawProvisionWorkflow, [
    trimmed,
    agent.id,
    user.id,
    modelProviderType,
    encryptedKey,
  ]);

  return { ok: true as const, runId: run.runId, agentId: agent.id };
}
