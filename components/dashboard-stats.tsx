"use client";

import useSWR from "swr";
import { Bot, Cpu, CheckCircle } from "lucide-react";
import type { Agent } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
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
  const { data } = useSWR<{ agents: Agent[] }>("/api/agents", fetcher, {
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

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <StatCard label="Total Workers" value={totalWorkers} icon={Bot} />
      <StatCard label="Active Workers" value={activeWorkers} icon={Cpu} />
      <StatCard label="Provisioning" value={provisioningWorkers} icon={CheckCircle} />
    </div>
  );
}
