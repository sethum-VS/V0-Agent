import { Sidebar } from "@/components/sidebar";
import { WorkerGrid } from "@/components/worker-grid";
import { ProvisionForm } from "@/components/provision-form";
import { DashboardStats } from "@/components/dashboard-stats";
import { requireAuthOrRedirect } from "@/lib/auth";

export default async function CommandCenter() {
  // Protect this route - redirects to /sign-in if not authenticated
  const user = await requireAuthOrRedirect();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userEmail={user.email} />

      <main className="flex-1 overflow-auto bg-grid-pattern">
        {/* Premium header with gradient border */}
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8">
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Overview
              </h1>
              <p className="text-xs text-muted-foreground">
                Monitor and manage your AI worker agents
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </span>
                <span className="text-xs font-medium text-emerald-400">System Online</span>
              </div>
            </div>
          </div>
          {/* Bottom gradient line */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </header>

        <div className="p-8">
          <DashboardStats />

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <section>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground tracking-tight">
                    Active Worker Agents
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time status of your deployed agents
                  </p>
                </div>
              </div>
              <WorkerGrid />
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <ProvisionForm />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
