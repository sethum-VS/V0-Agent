"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Copy, Check, Key, Sparkles, Terminal, Eye, EyeOff } from "lucide-react";
import { startProvisionWorker } from "@/app/actions/provision-worker";
import type { ProvisionHandoff } from "@/lib/provision-types";
import { cn } from "@/lib/utils";

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
  const [showApiKey, setShowApiKey] = useState(false);
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
    <Card className="border-border/50 bg-gradient-to-b from-card to-black/50 overflow-hidden">
      {/* Header gradient accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          Provision New Worker
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Runs a durable workflow: SOUL.md generation, gateway-backed provisioning, and link command.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Task Description
            </label>
            <Textarea
              placeholder="Describe the task for the new worker agent..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="min-h-[100px] resize-none bg-input/50 border-border/50 placeholder:text-muted-foreground/50 focus:border-ring focus:ring-1 focus:ring-ring transition-all"
              disabled={busy}
            />
          </div>

          {/* Model Configuration Section */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Model Configuration
            </label>
            
            {/* Toggle buttons with premium styling */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModelProvider("system")}
                disabled={busy}
                className={cn(
                  "relative flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200",
                  modelProvider === "system"
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.15)]"
                    : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:border-border",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Sparkles className={cn(
                  "h-4 w-4 transition-colors",
                  modelProvider === "system" ? "text-blue-400" : "text-muted-foreground"
                )} />
                Demo AI
                {modelProvider === "system" && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 h-px w-12 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setModelProvider("byok")}
                disabled={busy}
                className={cn(
                  "relative flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200",
                  modelProvider === "byok"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_16px_rgba(34,197,94,0.15)]"
                    : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:border-border",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Key className={cn(
                  "h-4 w-4 transition-colors",
                  modelProvider === "byok" ? "text-emerald-400" : "text-muted-foreground"
                )} />
                Your Key
                {modelProvider === "byok" && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 h-px w-12 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                )}
              </button>
            </div>

            {/* System model selection */}
            {modelProvider === "system" && (
              <div className="space-y-2 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEM_MODELS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSystemModel(m.value)}
                      disabled={busy}
                      className={cn(
                        "flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
                        systemModel === m.value
                          ? "border-blue-500/40 bg-blue-500/5 text-foreground"
                          : "border-border/40 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:border-border/60",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <span className="text-xs font-medium">{m.label}</span>
                      <span className="text-[10px] opacity-60 mt-0.5">{m.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* BYOK API key input with premium styling */}
            {modelProvider === "byok" && (
              <div className="space-y-2 animate-fade-in">
                <div className="relative">
                  <input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    disabled={busy}
                    className={cn(
                      "w-full rounded-lg border bg-input/30 px-4 py-3 pr-12 font-mono text-sm transition-all duration-200",
                      "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50",
                      apiKey ? "text-emerald-400 border-emerald-500/30" : "text-foreground border-border/50",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70">
                  Your key is encrypted with AES-256-GCM and only used by this agent.
                </p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className={cn(
              "w-full gap-2 font-medium transition-all duration-200",
              !busy && "bg-foreground text-background hover:bg-foreground/90",
              busy && "bg-secondary text-muted-foreground"
            )}
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

        {/* Status indicator */}
        {busy && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-amber-400 animate-ping opacity-75" />
              </div>
              <div>
                <span className="text-sm font-medium text-amber-400">
                  {pollStatus === "queued" ? "Queued" : "Thinking"}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pollStatus === "queued"
                    ? "Workflow run is starting..."
                    : "Generating SOUL.md via AI Gateway..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 animate-fade-in">
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          </div>
        )}

        {/* Success state with terminal-style output */}
        {handoff && pollStatus === "completed" && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium text-emerald-400">
                  Provisioned successfully
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Run the command below to connect your local daemon.
              </p>
            </div>

            {/* SOUL.md preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  SOUL.md
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => copyText("soul", handoff.soulMd)}
                >
                  {copiedField === "soul" ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedField === "soul" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="max-h-32 overflow-auto rounded-lg bg-input/30 border border-border/30 p-3 text-xs leading-relaxed text-muted-foreground font-mono">
                {handoff.soulMd}
              </pre>
            </div>

            {/* Link command in terminal style */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Link Command
              </span>
              <div className="terminal-block overflow-hidden">
                <div className="terminal-dots">
                  <div className="terminal-dot terminal-dot-red" />
                  <div className="terminal-dot terminal-dot-yellow" />
                  <div className="terminal-dot terminal-dot-green" />
                </div>
                <div className="pt-9 pb-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <code className="text-xs text-emerald-400 font-mono break-all">
                        {handoff.linkCommand}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 shrink-0 transition-all",
                        copiedField === "link"
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                      onClick={() => copyText("link", handoff.linkCommand)}
                    >
                      {copiedField === "link" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
