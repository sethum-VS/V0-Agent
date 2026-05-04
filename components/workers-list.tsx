"use client";

import { useState } from "react";
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
