"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, MoreHorizontal, Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus } from "@/lib/db";

/** Computed display status including offline detection */
type DisplayStatus = AgentStatus | "offline";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  animate?: boolean;
}

const statusConfigs: Record<DisplayStatus, StatusConfig> = {
  provisioning: {
    label: "Thinking",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    dotColor: "bg-amber-400",
    animate: true,
  },
  awaiting_connection: {
    label: "Awaiting Link",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    dotColor: "bg-blue-400",
  },
  online: {
    label: "System Online",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    dotColor: "bg-emerald-400",
  },
  offline: {
    label: "Offline",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    dotColor: "bg-red-400",
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
}

export function AgentCard({ agent, linkCommand }: AgentCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const displayStatus = computeDisplayStatus(agent);
  const config = statusConfigs[displayStatus];
  const timeSince = formatTimeSince(agent.last_heartbeat);

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
    <Card className="group transition-colors hover:border-muted-foreground/50">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            {displayStatus === "provisioning" ? (
              <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
            ) : (
              <Bot className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <CardTitle className="text-base font-medium">{agent.name}</CardTitle>
            {displayStatus === "online" && timeSince && (
              <p className="text-xs text-muted-foreground">Last seen {timeSince}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {agent.task_description}
        </p>

        <Badge
          variant="secondary"
          className={cn("gap-1.5 border-0", config.bgColor, config.color)}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              config.dotColor,
              config.animate && "animate-pulse"
            )}
          />
          {config.label}
        </Badge>

        {/* Show link command for agents awaiting connection */}
        {displayStatus === "awaiting_connection" && linkCommand && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Link command</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={copyLinkCommand}
              >
                {copiedLink ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto rounded bg-secondary/50 p-2 text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {linkCommand}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
