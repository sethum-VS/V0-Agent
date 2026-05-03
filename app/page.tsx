import { Sidebar } from "@/components/sidebar";
import { WorkerGrid } from "@/components/worker-grid";
import { ProvisionForm } from "@/components/provision-form";
import { Bot, Cpu, CheckCircle } from "lucide-react";

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

export default function CommandCenter() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            System Online
          </div>
        </header>

        <div className="p-8">
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Workers" value={6} icon={Bot} />
            <StatCard label="Active Tasks" value={2} icon={Cpu} />
            <StatCard label="Completed Today" value={12} icon={CheckCircle} />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <section>
              <h2 className="mb-4 text-lg font-medium text-foreground">
                Active Worker Agents
              </h2>
              <WorkerGrid />
            </section>

            <aside>
              <ProvisionForm />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
