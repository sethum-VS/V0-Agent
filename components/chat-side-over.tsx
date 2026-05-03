"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentMessage } from "@/lib/db";

interface ChatSideOverProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSideOver({ agentId, agentName, isOpen, onClose }: ChatSideOverProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages every 2 seconds
  const { data, mutate } = useSWR(
    isOpen ? `/api/agents/${agentId}/messages` : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<{ messages: AgentMessage[] }>;
    },
    { refreshInterval: 2000 }
  );

  const messages = data?.messages ?? [];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    setInput("");

    try {
      const res = await fetch(`/api/agents/${agentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // Revalidate messages
      mutate();
    } catch (error) {
      console.error("[v0] Error sending message:", error);
      setInput(input); // Restore on error
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-hidden rounded-l-2xl border border-l border-border/40 bg-background shadow-2xl shadow-black/40 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-gradient-to-b from-slate-900 via-slate-950 to-background px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{agentName}</h2>
            <p className="text-xs text-muted-foreground">Chat with your agent</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="text-xs text-muted-foreground">
                  No messages yet. Start a conversation!
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 animate-fade-in",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-xs px-4 py-2.5 rounded-lg text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-emerald-600/80 text-white"
                      : msg.role === "system"
                      ? "bg-slate-700/50 text-slate-200"
                      : "bg-slate-800/60 text-slate-100"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border/40 bg-gradient-to-t from-slate-950 to-slate-900/50 px-4 py-4 space-y-3">
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
              className="flex h-9 w-full rounded-md border border-border/40 bg-slate-900/50 px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              size="icon"
              className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
