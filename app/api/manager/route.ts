import { serve } from "@upstash/workflow/nextjs";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export const { POST } = serve<{ task: string }>(async (context) => {
  "use workflow";

  const { task } = context.requestPayload;

  const personaPlan = await context.run("plan-workers", async () => {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `You are an AI Agent Manager responsible for breaking down a high-level task into a team of specialized worker agents.

For the task below, design a team of worker agents and define each one as an OpenClaw SOUL.md persona. Each persona must capture the agent's identity, mission, expertise, behavioral rules, and the specific subtask it owns.

Return ONLY valid JSON (no markdown, no commentary) in exactly this shape:

{
  "task": "<original task summary>",
  "workers": [
    {
      "id": "<kebab-case identifier>",
      "name": "<short human-friendly name>",
      "soul": {
        "identity": "<who this agent is>",
        "mission": "<what this agent is responsible for>",
        "expertise": ["<skill 1>", "<skill 2>"],
        "personality": "<tone and behavioral traits>",
        "principles": ["<guiding principle 1>", "<guiding principle 2>"],
        "constraints": ["<hard rule 1>", "<hard rule 2>"],
        "tools": ["<tool or capability 1>", "<tool or capability 2>"],
        "subtask": "<the concrete piece of work this agent will execute>",
        "success_criteria": ["<measurable outcome 1>", "<measurable outcome 2>"]
      }
    }
  ]
}

Task to decompose:
"""
${task}
"""`,
    });

    return text;
  });

  return personaPlan;
});
