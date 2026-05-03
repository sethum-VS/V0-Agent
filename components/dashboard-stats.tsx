"use client";

import useSWR from "swr";
import { Bot, Cpu, Loader2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  accentColor?: "emerald" | "blue" | "amber" | "default";
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentColor = "default",
}: StatCardProps) {
  const accentStyles = {
    emerald: {
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      iconColor: "text-emerald-400",
      valueShadow: "drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]",
    },
    blue: {
      iconBg: "bg-blue-500/10 border-blue-500/20",
      iconColor: "text-blue-400",
      valueShadow: "drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]",
    },
    amber: {
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
      valueShadow: "drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]",
    },
    default: {
      iconBg: "bg-secondary border-border/50",
      iconColor: "text-muted-foreground",
      valueShadow: "",
    },
  };

  const styles = accentStyles[accentColor];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card to-black/50 p-5 transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-black/20">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className={cn(
            "text-3xl font-semibold text-foreground tracking-tight",
            styles.valueShadow
          )}>
            {value}
          </p>
        </div>
        <div className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300",
          styles.iconBg
        )}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
      </div>
    </div>
  );
}

/** Check if agent is considered offline (no heartbeat in >3 minutes) */
function isAgentOffline(agent: Agent): boolean {
  if (agent.status !== "online" || !agent.last_heartbeat) return false;
  const lastBeat = new Date(agent.last_heartbeat).getTime();
  const threeMinutesMs = 3 * 60 * 1000;
  return Date.now() - lastBeat > threeMinutesMs;
}

export function DashboardStats() {
  const { data, isLoading } = useSWR<{ agents: Agent[] }>("/api/agents", fetcher, {
    refreshInterval: 5000,
  });

  const agents = data?.agents ?? [];
  
  const totalWorkers = agents.length;
  const activeWorkers = agents.filter(
    (a) => a.status === "online" && !isAgentOffline(a)
  ).length;
  const provisioningWorkers = agents.filter(
    (a) => a.status === "provisioning"
  ).length;

  if (isLoading) {
    return (
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-gradient-to-b from-card to-black/50 p-5"
          >
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Total Workers"
        value={totalWorkers}
        icon={Bot}
        accentColor="default"
      />
      <StatCard
        label="Active Workers"
        value={activeWorkers}
        icon={Activity}
        accentColor="emerald"
      />
      <StatCard
        label="Provisioning"
        value={provisioningWorkers}
        icon={Cpu}
        accentColor="amber"
      />
    </div>
  );
}
