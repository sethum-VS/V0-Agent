"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Send, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentMessage } from "@/lib/db";

interface Agent {
  id: string;
  name: string;
  status: string;
}

export function ChatWindow() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all agents
  const { data: agentsData } = useSWR(
    "/api/agents",
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json() as Promise<{ agents: Agent[] }>;
    }
  );

  const agents = agentsData?.agents ?? [];

  // Auto-select first agent if available
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Fetch messages for selected agent every 2 seconds
  const { data, mutate } = useSWR(
    selectedAgentId ? `/api/agents/${selectedAgentId}/messages` : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<{ messages: AgentMessage[] }>;
    },
    { refreshInterval: 2000 }
  );

  const messages = data?.messages ?? [];
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending || !selectedAgentId) return;

    setSending(true);
    const messageContent = input;
    setInput("");

    try {
      const res = await fetch(`/api/agents/${selectedAgentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent.trim() }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // Revalidate messages
      mutate();
    } catch (error) {
      console.error("[v0] Error sending message:", error);
      setInput(messageContent); // Restore on error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Agents sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/30 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Available Agents
          </h3>
          <div className="space-y-2">
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No agents available</p>
            ) : (
              agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                    selectedAgentId === agent.id
                      ? "bg-secondary/80 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{agent.name}</span>
                    {selectedAgentId === agent.id && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground/70 mt-1">
                    {agent.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedAgent ? (
          <>
            {/* Chat header */}
            <div className="border-b border-border/50 bg-card/30 px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">{selectedAgent.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{selectedAgent.status}</p>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground italic">
                    Start a conversation with {selectedAgent.name}
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-sm px-4 py-2 rounded-lg",
                        msg.role === "user"
                          ? "bg-blue-500/20 text-blue-100 border border-blue-500/30"
                          : "bg-slate-700/30 text-foreground border border-slate-600/30"
                      )}
                    >
                      <p className="text-sm break-words">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border/50 bg-card/30 px-6 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                  className="flex-1 rounded-lg border border-border/40 bg-slate-900/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  size="sm"
                  className="px-3 gap-1.5"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="hidden sm:inline">Sending</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">
              {agents.length === 0
                ? "No agents available. Provision one to start chatting."
                : "Select an agent to start chatting"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
