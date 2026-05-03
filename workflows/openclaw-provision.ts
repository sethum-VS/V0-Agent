import { generateObject, generateText, APICallError, createGateway } from "ai";
import { z } from "zod";
import { FatalError } from "workflow";
import { neon } from "@neondatabase/serverless";
import type { ProvisionHandoff } from "@/lib/provision-types";
import type { ModelProviderType } from "@/lib/db";
import { decryptKey } from "@/lib/encryption";

const tokenSchema = z.object({
  botRegistrationId: z.string().min(1),
  messagingToken: z.string().min(1),
  webhookSecret: z.string().min(1),
});

/**
 * Explicit Vercel AI Gateway provider.
 *
 * On Vercel, the SDK can authenticate via the ambient OIDC token. For CI,
 * non-Vercel hosts, or when we want to pin to a specific gateway key, we pass
 * AI_GATEWAY_API_KEY explicitly. If the env var is unset, `apiKey` is left
 * undefined and the SDK falls back to OIDC.
 */
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

/** Default system model — used when no explicit model is chosen. */
const DEFAULT_SYSTEM_MODEL = "google/gemini-2.5-flash-lite";

/** Resolve the gateway model to use. Falls back to the default if not supplied. */
function resolveSystemModel(modelString?: string) {
  return gateway(modelString ?? DEFAULT_SYSTEM_MODEL);
}



/**
 * Get the model used by the provisioning workflow.
 *
 * The cloud-side provisioning workflow always uses the system AI Gateway —
 * even for BYOK agents — because generating SOUL.md is internal infrastructure
 * work, not user-attributable inference. The user's BYOK key is stored
 * encrypted and surfaced to the local daemon at runtime via the handoff
 * payload, so all *runtime* inference (the actual agent doing work) bills
 * against the user's key.
 *
 * Parameters are kept on the call sites so that future changes (e.g. routing
 * a specific step through BYOK) only need to update this function.
 */
function getModel(
  _providerType: ModelProviderType,
  _encryptedApiKey: string | null,
  systemModel?: string,
) {
  return resolveSystemModel(systemModel);
}

/**
 * Database client for workflow steps.
 * We create it lazily inside steps to ensure DATABASE_URL is available.
 */
function getDb() {
  return neon(process.env.DATABASE_URL!);
}

async function generateSoulMdStep(
  userPrompt: string,
  providerType: ModelProviderType,
  encryptedApiKey: string | null,
  systemModel?: string,
) {
  "use step";

  console.log("[openclaw-provision] step generateSoulMd start", { systemModel });

  const model = getModel(providerType, encryptedApiKey, systemModel);

  const { text } = await generateText({
    model,
    prompt: `You are an expert at OpenClaw agent configuration. The user will run a local OpenClaw worker (daemon) for a specific development task.

Write a single, production-ready SOUL.md document (Markdown) for ONE worker agent that will execute this task. The file must be copy-pasteable into ./config/SOUL.md for use with the openclaw/daemon image.

Include these sections with clear headings:
- Identity
- Mission
- Operating context (how it fits into the user's task)
- Expertise & tools
- Behavioral rules & principles
- Constraints & safety
- Task playbook (step-by-step how it should work)
- Success criteria
- Handoff & escalation

Ground everything in the user's task. Be concrete and concise. No JSON, no XML — valid Markdown only.

User task:
"""
${userPrompt}
"""`,
    providerOptions: {
      gateway: {
        tags: ["feature:openclaw-provision", "step:soul-md"],
      },
    },
  });

  if (!text?.trim()) {
    throw new FatalError("SOUL.md generation returned empty content");
  }

  console.log("[openclaw-provision] step generateSoulMd done");
  return text.trim();
}

/**
 * Updates the agent record with the generated SOUL.md configuration.
 * Scoped by both agentId AND userId to enforce tenant isolation.
 */
async function updateAgentSoulConfigStep(
  agentId: string,
  userId: string,
  soulConfig: string
) {
  "use step";

  console.log("[openclaw-provision] step updateAgentSoulConfig start");

  const sql = getDb();
  await sql`
    UPDATE agents
    SET soul_config = ${soulConfig}, updated_at = now()
    WHERE id = ${agentId} AND user_id = ${userId}
  `;

  console.log("[openclaw-provision] step updateAgentSoulConfig done");
}

async function provisionApiStep(
  userPrompt: string,
  providerType: ModelProviderType,
  encryptedApiKey: string | null,
  systemModel?: string,
) {
  "use step";

  console.log("[openclaw-provision] step provisionApi start");

  const model = getModel(providerType, encryptedApiKey, systemModel);
  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: tokenSchema,
        prompt: `You simulate the JSON response of an external "bot registration" API that runs behind Vercel AI Gateway.
The real system would register an OpenClaw worker and return secrets. For this simulation, invent plausible-looking opaque tokens (no real secrets) consistent with the task.

Return ONLY data matching the schema. Task summary:
"""
${userPrompt}
"""`,
        providerOptions: {
          gateway: {
            tags: ["feature:openclaw-provision", "step:api-provision"],
          },
        },
      });

      console.log("[openclaw-provision] step provisionApi done");
      return object;
    } catch (err) {
      lastError = err;
      if (APICallError.isInstance(err) && err.statusCode === 429) {
        const waitMs = Math.min(8000, 500 * 2 ** attempt);
        console.warn(
          `[openclaw-provision] provisionApi rate limited, retry ${attempt}/${maxAttempts} in ${waitMs}ms`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }

  console.error("[openclaw-provision] step provisionApi failed after retries", lastError);
  throw lastError instanceof Error ? lastError : new Error("provisionApi failed");
}

/**
 * Marks the agent as ready for daemon connection.
 * Scoped by both agentId AND userId to enforce tenant isolation.
 */
async function updateAgentStatusStep(
  agentId: string,
  userId: string,
  status: "provisioning" | "awaiting_connection" | "online" | "offline"
) {
  "use step";

  console.log(`[openclaw-provision] step updateAgentStatus -> ${status}`);

  const sql = getDb();
  await sql`
    UPDATE agents
    SET status = ${status}, updated_at = now()
    WHERE id = ${agentId} AND user_id = ${userId}
  `;

  console.log("[openclaw-provision] step updateAgentStatus done");
}

async function handoffStep(
  soulMd: string,
  tokens: z.infer<typeof tokenSchema>,
  agentId: string,
  providerType: ModelProviderType,
  encryptedApiKey: string | null,
): Promise<ProvisionHandoff> {
  "use step";

  console.log("[openclaw-provision] step handoff start");

  // Resolve the base URL: use VERCEL_PROJECT_PRODUCTION_URL on Vercel,
  // fall back to NEXTAUTH_URL or localhost for local dev.
  const baseUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Build link command
  let linkCommand = `openclaw link --agent-id ${agentId} --endpoint ${baseUrl}/api/agents`;

  // If BYOK, inject the user's API key into the SOUL.md configuration
  let finalSoulMd = soulMd;
  if (providerType === "byok" && encryptedApiKey) {
    // Add environment configuration section to SOUL.md
    finalSoulMd = `${soulMd}

---

## Environment Configuration

This agent uses your personal OpenAI API key. The following environment variable will be injected at runtime:

\`\`\`
OPENAI_API_KEY=<your-encrypted-key>
\`\`\`

The daemon will decrypt and use this key for all AI operations.
`;
  }

  const payload: ProvisionHandoff = {
    soulMd: finalSoulMd,
    tokens,
    linkCommand,
  };

  console.log("[openclaw-provision] step handoff done");
  return payload;
}

export async function openclawProvisionWorkflow(
  userPrompt: string,
  agentId: string,
  userId: string,
  providerType: ModelProviderType = "system",
  encryptedApiKey: string | null = null,
  systemModel?: string,
) {
  "use workflow";

  console.log("[openclaw-provision] workflow start", { agentId, userId, providerType, systemModel });

  // Step 1: Generate the SOUL.md configuration
  const soulMd = await generateSoulMdStep(userPrompt, providerType, encryptedApiKey, systemModel);

  // Step 2: Persist the soul config to the database (user-scoped)
  await updateAgentSoulConfigStep(agentId, userId, soulMd);

  // Step 3: Provision API tokens
  const tokens = await provisionApiStep(userPrompt, providerType, encryptedApiKey, systemModel);

  // Step 4: Build the handoff payload (includes the openclaw link command)
  const handoff = await handoffStep(soulMd, tokens, agentId, providerType, encryptedApiKey);

  // Step 5: Mark agent as ready for daemon connection (user-scoped)
  await updateAgentStatusStep(agentId, userId, "awaiting_connection");

  console.log("[openclaw-provision] workflow complete");
  return handoff;
}
