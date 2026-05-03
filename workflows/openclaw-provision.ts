import { generateObject, generateText, APICallError } from "ai";
import { z } from "zod";
import { FatalError } from "workflow";
import type { ProvisionHandoff } from "@/lib/provision-types";

const tokenSchema = z.object({
  botRegistrationId: z.string().min(1),
  messagingToken: z.string().min(1),
  webhookSecret: z.string().min(1),
});

/** Model id routes through Vercel AI Gateway when deployed on Vercel or when OIDC/key is configured. */
const GATEWAY_MODEL = "openai/gpt-5.4";

async function generateSoulMdStep(userPrompt: string) {
  "use step";

  console.log("[openclaw-provision] step generateSoulMd start");

  const { text } = await generateText({
    model: GATEWAY_MODEL,
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

async function provisionApiStep(userPrompt: string) {
  "use step";

  console.log("[openclaw-provision] step provisionApi start");

  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { object } = await generateObject({
        model: GATEWAY_MODEL,
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

async function handoffStep(
  soulMd: string,
  tokens: z.infer<typeof tokenSchema>,
): Promise<ProvisionHandoff> {
  "use step";

  console.log("[openclaw-provision] step handoff start");

  const dockerCommand = [
    "docker run --rm -it \\",
    '  -v "$(pwd)/config:/app/config" \\',
    `  -e OPENCLAW_BOT_ID=${tokens.botRegistrationId} \\`,
    `  -e OPENCLAW_MESSAGING_TOKEN=${tokens.messagingToken} \\`,
    `  -e OPENCLAW_WEBHOOK_SECRET=${tokens.webhookSecret} \\`,
    "  openclaw/daemon:latest",
  ].join("\n");

  const payload: ProvisionHandoff = {
    soulMd,
    tokens,
    dockerCommand,
  };

  console.log("[openclaw-provision] step handoff done");
  return payload;
}

export async function openclawProvisionWorkflow(userPrompt: string) {
  "use workflow";

  console.log("[openclaw-provision] workflow start");

  const soulMd = await generateSoulMdStep(userPrompt);
  const tokens = await provisionApiStep(userPrompt);
  const handoff = await handoffStep(soulMd, tokens);

  console.log("[openclaw-provision] workflow complete");
  return handoff;
}
