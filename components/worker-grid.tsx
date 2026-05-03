"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { AgentCard } from "@/components/agent-card";
import { ChatSideOver } from "@/components/chat-side-over";
import { Loader2, Bot } from "lucide-react";
import type { Agent } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** Derive the link command from agent id + current origin */
function buildLinkCommand(agentId: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  return `openclaw link --agent-id ${agentId} --endpoint ${baseUrl}/api/agents`;
}

export function WorkerGrid() {
  const { mutate } = useSWRConfig();
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const cancelAgent = useCallback(async (agentId: string) => {
    await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    mutate("/api/agents");
  }, [mutate]);

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
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl" />
          <Loader2 className="relative h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center animate-fade-in">
        <p className="text-sm text-red-400">
          Failed to load agents. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const agents = data?.agents ?? [];

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-gradient-to-b from-card/50 to-transparent p-12 text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/50 border border-border/50">
          <Bot className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-foreground">No agents yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the form to provision your first worker agent.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            linkCommand={
              agent.status === "awaiting_connection"
                ? buildLinkCommand(agent.id)
                : undefined
            }
            onCancel={
              agent.status === "provisioning" || agent.status === "awaiting_connection"
                ? () => cancelAgent(agent.id)
                : undefined
            }
            onChat={
              agent.status === "online"
                ? () => {
                    setSelectedAgent(agent);
                    setChatOpen(true);
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* Chat slide-over */}
      {selectedAgent && (
        <ChatSideOver
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
