"use server";

import { start } from "workflow/api";
import { openclawProvisionWorkflow } from "@/workflows/openclaw-provision";

export async function startProvisionWorker(taskDescription: string) {
  const trimmed = taskDescription.trim();
  if (!trimmed) {
    return { ok: false as const, error: "Task description is required." };
  }

  const run = await start(openclawProvisionWorkflow, [trimmed]);
  return { ok: true as const, runId: run.runId };
}
