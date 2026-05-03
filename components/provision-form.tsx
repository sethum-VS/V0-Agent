"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Copy, Check, Key, Sparkles } from "lucide-react";
import { startProvisionWorker } from "@/app/actions/provision-worker";
import type { ProvisionHandoff } from "@/lib/provision-types";

type PollStatus = "idle" | "queued" | "thinking" | "completed" | "failed";
type ModelProvider = "system" | "byok";

const SYSTEM_MODELS: { value: string; label: string; note: string }[] = [
  {
    value: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    note: "Fastest · cheapest",
  },
  {
    value: "openai/gpt-5.5",
    label: "GPT-5.5",
    note: "Most capable",
  },
];

function mapApiStatus(
  status: string,
  prev: PollStatus,
): PollStatus {
  if (status === "completed") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "pending") return "queued";
  if (status === "running") return "thinking";
  return prev;
}

export function ProvisionForm() {
  const { mutate } = useSWRConfig();
  const [taskDescription, setTaskDescription] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("system");
  const [systemModel, setSystemModel] = useState(SYSTEM_MODELS[0].value);
  const [apiKey, setApiKey] = useState("");
  const [pollStatus, setPollStatus] = useState<PollStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<ProvisionHandoff | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setHandoff(null);
    stopPolling();

    const task = taskDescription.trim();
    if (!task) return;

    // Validate BYOK API key if selected
    if (modelProvider === "byok" && !apiKey.trim()) {
      setError("Please enter your OpenAI API key");
      return;
    }

    setPollStatus("queued");

    const started = await startProvisionWorker(
      task,
      modelProvider,
      modelProvider === "byok" ? apiKey.trim() : undefined,
      modelProvider === "system" ? systemModel : undefined,
    );
    if (!started.ok) {
      setPollStatus("failed");
      setError(started.error);
      return;
    }

    const { runId } = started;
    setPollStatus("thinking");

    // Immediately refresh the agents list to show the new provisioning agent
    mutate("/api/agents");

    const tick = async () => {
      try {
        const res = await fetch(`/api/workflow?runId=${encodeURIComponent(runId)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            typeof err === "object" && err && "error" in err
              ? String((err as { error: unknown }).error)
              : `HTTP ${res.status}`,
          );
        }
        const data = (await res.json()) as {
          status: string;
          result?: ProvisionHandoff;
        };

        setPollStatus((prev) => mapApiStatus(data.status, prev));

        if (data.status === "completed" && data.result) {
          setHandoff(data.result);
          stopPolling();
          setTaskDescription("");
          setApiKey("");
          // Refresh agents list to show updated status
          mutate("/api/agents");
        } else if (data.status === "failed" || data.status === "cancelled") {
          setError("Workflow did not complete successfully. Check server logs or run `npx workflow inspect runs`.");
          stopPolling();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed");
        setPollStatus("failed");
        stopPolling();
      }
    };

    await tick();
    pollRef.current = setInterval(tick, 1500);
  };

  const busy = pollStatus === "queued" || pollStatus === "thinking";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Provision New Worker</CardTitle>
        <p className="text-xs text-muted-foreground">
          Runs a durable Vercel Workflow: SOUL.md generation → gateway-backed provisioning → link command.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Describe the task for the new worker agent..."
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            className="min-h-[100px] resize-none bg-secondary/50"
            disabled={busy}
          />

          {/* Model Configuration Section */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Model Configuration</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModelProvider("system")}
                disabled={busy}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  modelProvider === "system"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                } disabled:opacity-50`}
              >
                <Sparkles className="h-4 w-4" />
                Demo AI
              </button>
              <button
                type="button"
                onClick={() => setModelProvider("byok")}
                disabled={busy}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  modelProvider === "byok"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                } disabled:opacity-50`}
              >
                <Key className="h-4 w-4" />
                Your Key
              </button>
            </div>

            {modelProvider === "system" && (
              <div className="space-y-1">
                <label htmlFor="systemModel" className="text-xs text-muted-foreground">
                  Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEM_MODELS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSystemModel(m.value)}
                      disabled={busy}
                      className={`flex flex-col items-start rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                        systemModel === m.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      } disabled:opacity-50`}
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className="opacity-70">{m.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modelProvider === "byok" && (
              <div className="space-y-2">
                <label htmlFor="apiKey" className="text-xs text-muted-foreground">
                  OpenAI API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  disabled={busy}
                  className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  Your key is encrypted and only used by this agent.
                </p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={!taskDescription.trim() || busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {pollStatus === "queued" ? "Queued..." : "Provisioning..."}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Provision Worker
              </>
            )}
          </Button>
        </form>

        {busy && (
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {pollStatus === "queued" ? "Queued" : "Thinking"}
            </span>
            {" — "}
            {pollStatus === "queued"
              ? "Workflow run is starting."
              : "Generating SOUL.md and provisioning tokens via AI Gateway..."}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {handoff && pollStatus === "completed" && (
          <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <p className="font-medium text-emerald-600 dark:text-emerald-400">
              Provisioned — run the command below to connect your local daemon
            </p>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">SOUL.md</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={() => copyText("soul", handoff.soulMd)}
                >
                  {copiedField === "soul" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
              </div>
              <pre className="max-h-40 overflow-auto rounded bg-background/80 p-2 text-xs leading-relaxed">
                {handoff.soulMd}
              </pre>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Link command</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={() => copyText("link", handoff.linkCommand)}
                >
                  {copiedField === "link" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded bg-background/80 p-2 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                {handoff.linkCommand}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
