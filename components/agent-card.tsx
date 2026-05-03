"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, MoreHorizontal, Copy, Check, Loader2, Terminal, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus } from "@/lib/db";

/** Computed display status including offline detection */
type DisplayStatus = AgentStatus | "offline";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  glowColor: string;
  animate?: "pulse" | "breathe";
}

const statusConfigs: Record<DisplayStatus, StatusConfig> = {
  provisioning: {
    label: "Thinking",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    dotColor: "bg-amber-400",
    glowColor: "shadow-[0_0_12px_rgba(251,191,36,0.4)]",
    animate: "pulse",
  },
  awaiting_connection: {
    label: "Awaiting Link",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    dotColor: "bg-blue-400",
    glowColor: "shadow-[0_0_12px_rgba(59,130,246,0.4)]",
  },
  online: {
    label: "System Online",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    dotColor: "bg-emerald-400",
    glowColor: "shadow-[0_0_12px_rgba(34,197,94,0.4)]",
    animate: "breathe",
  },
  offline: {
    label: "Offline",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    dotColor: "bg-red-400",
    glowColor: "shadow-[0_0_12px_rgba(239,68,68,0.3)]",
  },
};

/** Check if agent is offline (no heartbeat in >3 minutes) */
function computeDisplayStatus(agent: Agent): DisplayStatus {
  if (agent.status === "online" && agent.last_heartbeat) {
    const lastBeat = new Date(agent.last_heartbeat).getTime();
    const now = Date.now();
    const threeMinutesMs = 3 * 60 * 1000;
    if (now - lastBeat > threeMinutesMs) {
      return "offline";
    }
  }
  return agent.status;
}

/** Format relative time since last heartbeat */
function formatTimeSince(date: Date | string | null): string | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface AgentCardProps {
  agent: Agent;
  /** Link command to display when awaiting_connection */
  linkCommand?: string;
  /** Called when the user confirms cancellation — only provided for cancellable statuses */
  onCancel?: () => void;
}

export function AgentCard({ agent, linkCommand, onCancel }: AgentCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayStatus = computeDisplayStatus(agent);
  const config = statusConfigs[displayStatus];
  const timeSince = formatTimeSince(agent.last_heartbeat);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleCancel = async () => {
    if (!onCancel) return;
    setCancelling(true);
    setMenuOpen(false);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

  const copyLinkCommand = async () => {
    if (!linkCommand) return;
    try {
      await navigator.clipboard.writeText(linkCommand);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  };

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-gradient-to-b from-card to-black/50 transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-black/20 card-glow animate-fade-in">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300",
            displayStatus === "provisioning" 
              ? "bg-amber-500/10 border-amber-500/30" 
              : displayStatus === "online"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-secondary border-border"
          )}>
            {displayStatus === "provisioning" ? (
              <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
            ) : (
              <Bot className={cn(
                "h-5 w-5 transition-colors",
                displayStatus === "online" ? "text-emerald-400" : "text-muted-foreground"
              )} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              {agent.name}
            </h3>
            {displayStatus === "online" && timeSince && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last seen {timeSince}
              </p>
            )}
          </div>
        </div>
        {/* 3-dot menu — only rendered when there are actions available */}
        {onCancel && (
          <div ref={menuRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={cancelling}
              aria-label="Agent options"
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 min-w-[160px] overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl shadow-black/40 animate-fade-in">
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={handleCancel}
                >
                  <XCircle className="h-4 w-4 shrink-0" />
                  Cancel request
                </button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="relative space-y-4">
        <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
          {agent.task_description}
        </p>

        {/* Premium status badge */}
        <div className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
          config.bgColor,
          config.borderColor,
          config.color
        )}>
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              config.dotColor,
              config.animate === "pulse" && "animate-pulse",
              config.animate === "breathe" && "animate-breathe",
              config.glowColor
            )}
          />
          {config.label}
        </div>

        {/* MacOS-style terminal for link command */}
        {displayStatus === "awaiting_connection" && linkCommand && (
          <div className="mt-4 terminal-block overflow-hidden">
            {/* Terminal header dots */}
            <div className="terminal-dots">
              <div className="terminal-dot terminal-dot-red" />
              <div className="terminal-dot terminal-dot-yellow" />
              <div className="terminal-dot terminal-dot-green" />
            </div>
            
            {/* Terminal content */}
            <div className="pt-9 pb-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs text-emerald-400 font-mono break-all leading-relaxed">
                    {linkCommand}
                  </code>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 shrink-0 transition-all",
                    copiedLink 
                      ? "text-emerald-400 bg-emerald-500/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                  onClick={copyLinkCommand}
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
