"use server";

import { start } from "workflow/api";
import { openclawProvisionWorkflow } from "@/workflows/openclaw-provision";
import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function startProvisionWorker(taskDescription: string) {
  // Enforce authentication - throws if no user
  const user = await requireAuth();

  const trimmed = taskDescription.trim();
  if (!trimmed) {
    return { ok: false as const, error: "Task description is required." };
  }

  // Generate a human-readable agent name from the task
  const agentName = `Worker-${Date.now().toString(36).toUpperCase()}`;

  // Insert the agent record with 'provisioning' status
  const [agent] = await sql<{ id: string }[]>`
    INSERT INTO agents (user_id, name, task_description, status)
    VALUES (${user.id}, ${agentName}, ${trimmed}, 'provisioning')
    RETURNING id
  `;

  // Start the workflow, passing the agent ID for status updates
  const run = await start(openclawProvisionWorkflow, [trimmed, agent.id, user.id]);

  return { ok: true as const, runId: run.runId, agentId: agent.id };
}
