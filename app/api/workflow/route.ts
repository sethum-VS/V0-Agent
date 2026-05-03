import { getRun, start } from "workflow/api";
import { NextResponse } from "next/server";
import type { ProvisionHandoff } from "@/lib/provision-types";
import { openclawProvisionWorkflow } from "@/workflows/openclaw-provision";
import type { ModelProviderType } from "@/lib/db";

interface WorkflowRequestBody {
  task?: string;
  agentId?: string;
  userId?: string;
  providerType?: ModelProviderType;
  encryptedApiKey?: string | null;
}

export async function POST(request: Request) {
  let body: WorkflowRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  const agentId = typeof body.agentId === "string" ? body.agentId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const providerType: ModelProviderType = body.providerType === "byok" ? "byok" : "system";
  const encryptedApiKey = body.encryptedApiKey ?? null;

  if (!task) {
    return NextResponse.json({ error: "Missing string field: task" }, { status: 400 });
  }
  if (!agentId) {
    return NextResponse.json({ error: "Missing string field: agentId" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing string field: userId" }, { status: 400 });
  }

  const run = await start(openclawProvisionWorkflow, [task, agentId, userId, providerType, encryptedApiKey]);
  return NextResponse.json({ runId: run.runId });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "runId query parameter is required" }, { status: 400 });
  }

  const run = getRun<ProvisionHandoff>(runId);

  if (!(await run.exists)) {
    return NextResponse.json({ error: "Workflow run not found" }, { status: 404 });
  }

  const status = await run.status;

  if (status === "completed") {
    const result = await run.returnValue;
    return NextResponse.json({ status, result });
  }

  if (status === "failed" || status === "cancelled") {
    return NextResponse.json({ status });
  }

  return NextResponse.json({ status });
}
