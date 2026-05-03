"use client";

import useSWR from "swr";
import { AgentCard } from "@/components/agent-card";
import { Loader2 } from "lucide-react";
import type { Agent } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** Derive the link command from agent id + current origin */
function buildLinkCommand(agentId: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  return `openclaw link --agent-id ${agentId} --endpoint ${baseUrl}/api/agents`;
}

export function WorkerGrid() {
  const { data, error, isLoading } = useSWR<{ agents: Agent[] }>(
    "/api/agents",
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: true,
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading agents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load agents. Please try refreshing the page.
      </div>
    );
  }

  const agents = data?.agents ?? [];

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No agents provisioned yet. Use the form to create your first worker.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          linkCommand={
            agent.status === "awaiting_connection"
              ? buildLinkCommand(agent.id)
              : undefined
          }
        />
      ))}
    </div>
  );
}
