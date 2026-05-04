import { Sidebar } from "@/components/sidebar";
import { WorkersList } from "@/components/workers-list";
import { requireAuthOrRedirect } from "@/lib/auth";

export default async function WorkersPage() {
  const user = await requireAuthOrRedirect();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userEmail={user.email} currentPage="workers" />

      <main className="flex-1 overflow-auto bg-grid-pattern">
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8">
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Workers
              </h1>
              <p className="text-xs text-muted-foreground">
                View and manage your AI worker configurations
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </header>

        <div className="p-8">
          <WorkersList />
        </div>
      </main>
    </div>
  );
}
