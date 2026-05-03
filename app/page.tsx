import { Sidebar } from "@/components/sidebar";
import { WorkerGrid } from "@/components/worker-grid";
import { ProvisionForm } from "@/components/provision-form";
import { DashboardStats } from "@/components/dashboard-stats";
import { requireAuthOrRedirect } from "@/lib/auth";

export default async function CommandCenter() {
  // Protect this route - redirects to /sign-in if not authenticated
  const user = await requireAuthOrRedirect();

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={user.email} />

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            System Online
          </div>
        </header>

        <div className="p-8">
          <DashboardStats />

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
