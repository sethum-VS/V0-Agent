#!/usr/bin/env bun
/**
 * OpenClaw Daemon — managed wrapper entry point.
 *
 * This binary is shipped to end users. When invoked with `--managed <agent_id>`,
 * the daemon bypasses the standard local workspace/configuration discovery and
 * instead pulls its configuration from the Vercel-hosted control plane.
 *
 * Standard (unmanaged) invocations fall through to the original OpenClaw CLI.
 * Once the upstream OpenClaw repo is vendored into this directory, replace the
 * `runUnmanaged()` stub with the real CLI bootstrap (e.g. `import "./openclaw"`).
 */

import { runManagedBoot } from "./managed-bootstrap";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface ParsedArgs {
  managedAgentId: string | null;
  endpoint: string | null;
  rest: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  let managedAgentId: string | null = null;
  let endpoint: string | null = null;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--managed") {
      managedAgentId = argv[i + 1] ?? null;
      i++;
      continue;
    }
    if (arg === "--endpoint") {
      endpoint = argv[i + 1] ?? null;
      i++;
      continue;
    }
    rest.push(arg);
  }

  return { managedAgentId, endpoint, rest };
}

async function runUnmanaged(rest: string[]): Promise<void> {
  const cliDir = import.meta.dir;
  const upstreamEntryPath = resolve(cliDir, "../upstream/openclaw.mjs");

  if (!existsSync(upstreamEntryPath)) {
    console.log("[openclaw] unmanaged mode — no local OpenClaw entry point linked yet.");
    console.log("[openclaw] vendor the upstream repo and update src/cli.ts to forward here.");
    return;
  }

  const originalArgv = [...process.argv];
  process.argv = [originalArgv[0] ?? "openclaw", upstreamEntryPath, ...rest];

  try {
    await import(pathToFileURL(upstreamEntryPath).href);
  } catch (error) {
    console.error("[openclaw] failed to run vendored upstream entrypoint:", error);
    console.log("[openclaw] unmanaged mode fallback is active.");
  } finally {
    process.argv = originalArgv;
  }
}

async function main(): Promise<void> {
  const { managedAgentId, endpoint, rest } = parseArgs(Bun.argv.slice(2));

  if (managedAgentId) {
    await runManagedBoot({
      agentId: managedAgentId,
      endpoint: endpoint ?? process.env.OPENCLAW_ENDPOINT ?? null,
    });
    return;
  }

  await runUnmanaged(rest);
}

main().catch((err) => {
  console.error("[openclaw] fatal error:", err);
  process.exit(1);
});
