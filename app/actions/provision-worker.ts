"use server";

import { start } from "workflow/api";
import { openclawProvisionWorkflow } from "@/workflows/openclaw-provision";
import { sql } from "@/lib/db";
import type { ModelProviderType } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Simple encryption for API keys using base64 + XOR with a secret.
 * In production, use a proper encryption library like crypto.
 */
function encryptApiKey(apiKey: string): string {
  const secret = process.env.ENCRYPTION_SECRET || "openclaw-dev-secret";
  let encrypted = "";
  for (let i = 0; i < apiKey.length; i++) {
    encrypted += String.fromCharCode(
      apiKey.charCodeAt(i) ^ secret.charCodeAt(i % secret.length)
    );
  }
  return Buffer.from(encrypted).toString("base64");
}

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

  // Encrypt the API key if provided
  const encryptedKey = apiKey ? encryptApiKey(apiKey) : null;

  // Insert the agent record with 'provisioning' status
  const [agent] = await sql<{ id: string }[]>`
    INSERT INTO agents (user_id, name, task_description, status, model_provider_type, encrypted_api_key)
    VALUES (${user.id}, ${agentName}, ${trimmed}, 'provisioning', ${modelProviderType}, ${encryptedKey})
    RETURNING id
  `;

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
