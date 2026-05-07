"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  FileCode,
  Key,
  Loader2,
  Server,
  Settings,
  Activity,
  MessageSquare,
  Wifi,
  WifiOff,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDate(date: Date | string | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    online: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    offline: { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
    provisioning: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    awaiting_connection: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  }[status] || { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", config.bg, config.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {status.replace("_", " ")}
    </span>
  );
}

// ─── Diagnostics Panel ────────────────────────────────────────────────────────

type DiagnosticStatus = "idle" | "running" | "ok" | "error";

interface DiagnosticCheck {
  label: string;
  status: DiagnosticStatus;
  detail: string;
}

function DiagnosticsPanel({ agent }: { agent: Agent }) {
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [running, setRunning] = useState(false);

  // Fetch message count for this agent
  const { data: msgData } = useSWR<{ messages: { id: string }[] }>(
    `/api/agents/${agent.id}/messages`,
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 5000 }
  );
  const messageCount = msgData?.messages?.length ?? 0;

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const results: DiagnosticCheck[] = [];

    const update = (label: string, status: DiagnosticStatus, detail: string) => {
      results.push({ label, status, detail });
      setChecks([...results]);
    };

    // Check 1: Agent exists in DB
    update("Agent DB record", "running", "Checking...");
    try {
      const res = await fetch(`/api/agents/${agent.id}`);
      if (res.ok) {
        update("Agent DB record", "ok", `Found — status: ${agent.status}`);
      } else {
        update("Agent DB record", "error", `HTTP ${res.status}`);
      }
    } catch (e: any) {
      update("Agent DB record", "error", e.message);
    }

    // Check 2: Daemon heartbeat (is machine connected?)
    update("Daemon connection", "running", "Checking last heartbeat...");
    const lastHb = agent.last_heartbeat ? new Date(agent.last_heartbeat) : null;
    const secsSinceHb = lastHb ? Math.floor((Date.now() - lastHb.getTime()) / 1000) : null;
    if (agent.status === "online" && secsSinceHb !== null && secsSinceHb < 120) {
      update("Daemon connection", "ok", `Last heartbeat ${secsSinceHb}s ago`);
    } else if (agent.status === "awaiting_connection") {
      update("Daemon connection", "error", "Daemon not yet connected — run the install script");
    } else if (secsSinceHb !== null && secsSinceHb > 120) {
      update("Daemon connection", "error", `Stale heartbeat — ${secsSinceHb}s ago`);
    } else {
      update("Daemon connection", "error", "No heartbeat recorded");
    }

    // Check 3: Message poll endpoint
    update("Message poll API", "running", "Testing /daemon/messages...");
    try {
      const res = await fetch(`/api/agents/${agent.id}/daemon/messages`);
      if (res.ok) {
        const data = await res.json();
        update("Message poll API", "ok", `Endpoint OK — ${data.messages?.length ?? 0} unread msgs`);
      } else {
        update("Message poll API", "error", `HTTP ${res.status}`);
      }
    } catch (e: any) {
      update("Message poll API", "error", e.message);
    }

    // Check 4: AI inference test
    update("AI inference (gateway)", "running", "Sending test prompt...");
    try {
      const res = await fetch(`/api/agents/${agent.id}/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "ping", taskDescription: agent.task_description }),
      });
      if (res.ok) {
        const data = await res.json();
        const preview = data.response?.slice(0, 60) ?? "";
        update("AI inference (gateway)", "ok", `Response: "${preview}..."`);
      } else {
        const errData = await res.json().catch(() => ({}));
        update("AI inference (gateway)", "error", `HTTP ${res.status}: ${errData.details || errData.error || "unknown"}`);
      }
    } catch (e: any) {
      update("AI inference (gateway)", "error", e.message);
    }

    setRunning(false);
  }, [agent]);

  const statusIcon = (status: DiagnosticStatus) => {
    if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />;
    if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
    return <div className="h-3.5 w-3.5 rounded-full border border-border/60" />;
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
      {/* Diagnostics header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Diagnostics
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={runDiagnostics}
          disabled={running}
          className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {running ? "Running..." : "Run checks"}
        </Button>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-secondary/40 border border-border/40 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-base font-bold text-foreground">{messageCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Messages</p>
        </div>
        <div className="rounded-lg bg-secondary/40 border border-border/40 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            {agent.status === "online" ? (
              <Wifi className="h-3 w-3 text-emerald-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className={cn("text-base font-bold", agent.status === "online" ? "text-emerald-400" : "text-muted-foreground")}>
            {agent.status === "online" ? "Live" : "Off"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Connection</p>
        </div>
        <div className="rounded-lg bg-secondary/40 border border-border/40 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-base font-bold text-foreground">
            {agent.model_provider_type === "byok" ? "BYOK" : "AI"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Model</p>
        </div>
      </div>

      {/* Check results */}
      {checks.length > 0 && (
        <div className="rounded-lg bg-secondary/30 border border-border/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-secondary/40">
            <Terminal className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Check Results
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {checks.map((check, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <div className="mt-0.5 shrink-0">{statusIcon(check.status)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{check.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {checks.length === 0 && !running && (
        <p className="text-[11px] text-muted-foreground text-center py-2 italic">
          Click &quot;Run checks&quot; to verify connectivity and AI gateway health
        </p>
      )}
    </div>
  );
}

// ─── Worker Config Card ────────────────────────────────────────────────────────

function WorkerConfigCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-card/80 border-border/50 overflow-hidden transition-all duration-200 hover:border-border/80">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-secondary/50 border border-border/50">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{agent.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">
                {agent.task_description}
              </p>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Last seen: {formatDate(agent.last_heartbeat)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            <span>Machine: {agent.machine_id ? agent.machine_id.split("-")[0] : "Not connected"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            <span>Provider: {agent.model_provider_type === "byok" ? "Your Key" : "Demo AI"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Key className="h-3.5 w-3.5" />
            <span>API Key: {agent.encrypted_api_key ? "Configured" : "Not set"}</span>
          </div>
        </div>

        {/* Expandable config section */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            Configuration Details
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {expanded && (
          <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* Agent ID */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Agent ID
              </label>
              <div className="rounded-lg bg-secondary/50 border border-border/50 px-3 py-2">
                <code className="text-xs text-foreground font-mono">{agent.id}</code>
              </div>
            </div>

            {/* Soul Config / Task */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                <FileCode className="h-3 w-3" />
                Soul Configuration
              </label>
              <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 max-h-48 overflow-auto">
                {agent.soul_config ? (
                  <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                    {agent.soul_config}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No custom soul config. Using task description as system prompt.
                  </p>
                )}
              </div>
            </div>

            {/* Task Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Task Description
              </label>
              <div className="rounded-lg bg-secondary/50 border border-border/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">{agent.task_description}</p>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Created
                </label>
                <p className="text-xs text-muted-foreground">{formatDate(agent.created_at)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Updated
                </label>
                <p className="text-xs text-muted-foreground">{formatDate(agent.updated_at)}</p>
              </div>
            </div>

            {/* Live diagnostics panel */}
            <DiagnosticsPanel agent={agent} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkersList() {
  const { data, error, isLoading } = useSWR<{ agents: Agent[] }>("/api/agents", fetcher, {
    refreshInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-400">Failed to load workers</p>
      </div>
    );
  }

  const agents = data?.agents || [];

  if (agents.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50 border border-border/50">
          <Bot className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No workers provisioned yet</p>
        <p className="text-xs text-muted-foreground/70">
          Go to Overview to create your first worker agent
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <WorkerConfigCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
