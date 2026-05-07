/**
 * Managed boot sequence for the OpenClaw daemon.
 *
 * When the binary is launched with `--managed <agent_id>`, this module:
 *   1. Generates a stable machine ID (or loads it from the sandbox).
 *   2. Calls POST {endpoint}/sync to fetch the locked-down agent config.
 *   3. Materializes the config into a sandbox directory under ~/.openclaw/sandbox/<agent_id>.
 *   4. Starts a heartbeat loop against POST {endpoint}/heartbeat.
 *   5. Processes system commands from the message queue (SYS_CMD:*).
 *
 * The sandbox is intentionally isolated: the daemon never reads the user's
 * filesystem outside of this directory.
 */

import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCallback);

const HEARTBEAT_INTERVAL_MS = 30_000;
const MESSAGE_POLL_INTERVAL_MS = 5_000;
const DEFAULT_ENDPOINT = "https://openclaw.vercel.app/api/agents";

export interface ManagedBootOptions {
  agentId: string;
  endpoint: string | null;
}

interface SyncResponse {
  agentId: string;
  status: string;
  soulConfig: string | null;
  tokens: {
    botRegistrationId: string;
    messagingToken: string;
    webhookSecret: string;
  };
}

async function ensureSandbox(agentId: string): Promise<string> {
  const dir = join(homedir(), ".openclaw", "sandbox", agentId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

async function loadOrCreateMachineId(sandboxDir: string): Promise<string> {
  const machineIdPath = join(sandboxDir, "machine_id");
  if (existsSync(machineIdPath)) {
    return (await readFile(machineIdPath, "utf8")).trim();
  }
  const id = `${hostname()}-${randomUUID()}`;
  await writeFile(machineIdPath, id, "utf8");
  return id;
}

async function syncAgent(
  endpoint: string,
  agentId: string,
  machineId: string,
): Promise<SyncResponse> {
  const res = await fetch(`${endpoint}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, machineId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`sync failed: ${res.status} ${res.statusText} ${body}`);
  }
  return (await res.json()) as SyncResponse;
}

async function postMessage(
  endpoint: string,
  agentId: string,
  content: string,
): Promise<void> {
  try {
    const res = await fetch(`${endpoint}/${agentId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      console.warn(`[openclaw] Failed to post message: ${res.status}`);
    }
  } catch (err) {
    console.warn("[openclaw] Error posting message:", (err as Error).message);
  }
}

async function pollMessages(
  endpoint: string,
  agentId: string,
  sandboxDir: string,
  onUserMessage?: (content: string) => Promise<void>,
): Promise<void> {
  try {
    const res = await fetch(`${endpoint}/${agentId}/messages`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.warn(`[openclaw] message poll non-2xx: ${res.status}`);
      return;
    }

    const data = (await res.json()) as {
      messages: Array<{
        id: string;
        role: "user" | "agent" | "system";
        content: string;
        is_read: boolean;
      }>;
    };

    for (const msg of data.messages) {
      if (!msg.is_read) {
        // Handle system commands
        if (msg.role === "system" && msg.content.startsWith("SYS_CMD:")) {
          console.log(`[openclaw] Processing system command: ${msg.content.substring(0, 50)}...`);

          // INSTALL_SKILL:<slug>
          if (msg.content.startsWith("SYS_CMD:INSTALL_SKILL:")) {
            const slug = msg.content.split(":").slice(3).join(":");
            console.log("[openclaw] Installing skill: " + slug);
            try {
              const command = "npx -y clawhub install " + slug + " --dir " + sandboxDir;
              console.log("[openclaw] Executing: " + command);
              await exec(command);
              await postMessage(
                endpoint,
                agentId,
                "Successfully installed skill: " + slug
              );
              console.log("[openclaw] Skill installed successfully: " + slug);
            } catch (error: any) {
              const errorMsg = error.message || String(error);
              await postMessage(
                endpoint,
                agentId,
                "Skill installation failed: " + slug + " - " + errorMsg
              );
              console.error("[openclaw] Skill installation failed: " + errorMsg);
            }
            continue;
          }

          // ENABLE_CHANNEL:TELEGRAM:<token>
          if (msg.content.startsWith("SYS_CMD:ENABLE_CHANNEL:TELEGRAM:")) {
            const token = msg.content.split(":").slice(4).join(":");
            console.log("[openclaw] Enabling Telegram channel");
            try {
              const envPath = join(sandboxDir, ".env");
              const envContent = "TELEGRAM_BOT_TOKEN=" + token + "\n";
              await writeFile(envPath, envContent, "utf8");
              await postMessage(
                endpoint,
                agentId,
                "Telegram channel successfully linked"
              );
              console.log("[openclaw] Telegram channel enabled");
            } catch (error: any) {
              await postMessage(
                endpoint,
                agentId,
                "Telegram setup failed: " + error.message
              );
              console.error("[openclaw] Telegram setup failed:", error);
            }
            continue;
          }

          // DISABLE_CHANNEL:TELEGRAM
          if (msg.content === "SYS_CMD:DISABLE_CHANNEL:TELEGRAM") {
            console.log("[openclaw] Disabling Telegram channel");
            try {
              const envPath = join(sandboxDir, ".env");
              if (existsSync(envPath)) {
                await unlink(envPath);
              }
              await postMessage(
                endpoint,
                agentId,
                "Telegram channel disconnected"
              );
              console.log("[openclaw] Telegram channel disabled");
            } catch (error: any) {
              console.warn("[openclaw] Telegram disable warning: " + error.message);
            }
            continue;
          }

          console.log("[openclaw] Unknown system command: " + msg.content);
          continue;
        }

        // Handle user messages
        if (msg.role === "user") {
          console.log(`[openclaw] received user message: ${msg.content}`);
          if (onUserMessage) {
            await onUserMessage(msg.content);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[openclaw] message poll error:", (err as Error).message);
  }
}

async function sendHeartbeat(
  endpoint: string,
  agentId: string,
  machineId: string,
): Promise<void> {
  try {
    const res = await fetch(`${endpoint}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, machineId }),
    });
    if (!res.ok) {
      console.warn(`[openclaw] heartbeat non-2xx: ${res.status}`);
    }
  } catch (err) {
    console.warn("[openclaw] heartbeat error:", (err as Error).message);
  }
}

export async function runManagedBoot(options: ManagedBootOptions): Promise<void> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const { agentId } = options;

  console.log(`[openclaw] managed boot: agent=${agentId} endpoint=${endpoint}`);

  // Step 1: prepare sandbox
  const sandboxDir = await ensureSandbox(agentId);
  const machineId = await loadOrCreateMachineId(sandboxDir);
  console.log(`[openclaw] sandbox=${sandboxDir} machine=${machineId}`);

  // Step 2: pull config from control plane
  const config = await syncAgent(endpoint, agentId, machineId);
  console.log(`[openclaw] sync ok — status=${config.status}`);

  // Step 3: materialize SOUL.md + tokens into sandbox
  if (config.soulConfig) {
    await writeFile(join(sandboxDir, "SOUL.md"), config.soulConfig, "utf8");
  }
  await writeFile(
    join(sandboxDir, "tokens.json"),
    JSON.stringify(config.tokens, null, 2),
    "utf8",
  );

  // Step 4: start heartbeat loop
  console.log("[openclaw] heartbeat loop starting");
  await sendHeartbeat(endpoint, agentId, machineId);
  setInterval(() => {
    void sendHeartbeat(endpoint, agentId, machineId);
  }, HEARTBEAT_INTERVAL_MS);

  // Step 5: start message polling loop (with system command interception)
  console.log("[openclaw] message polling loop starting");
  setInterval(() => {
    void pollMessages(endpoint, agentId, sandboxDir, async (content: string) => {
      console.log(`[openclaw] processing user message: ${content}`);
      // TODO: pass to the real OpenClaw runtime for inference
    });
  }, MESSAGE_POLL_INTERVAL_MS);

  // TODO: hand off to the real OpenClaw runtime, scoped to `sandboxDir`.
  // For the wrapper this is a no-op event loop keep-alive.
  await new Promise<never>(() => {
    /* keep the daemon alive — never resolves */
  });
}
