import { Sidebar } from "@/components/sidebar";
import { ChatWindow } from "@/components/chat-window";
import { requireAuthOrRedirect } from "@/lib/auth";

export default async function ChatPage() {
  const user = await requireAuthOrRedirect();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userEmail={user.email} currentPage="chat" />

      <main className="flex-1 flex flex-col overflow-hidden bg-grid-pattern">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8">
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Chat with Agents
              </h1>
              <p className="text-xs text-muted-foreground">
                Interact with your deployed AI worker agents
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </span>
              <span className="text-xs font-medium text-emerald-400">System Online</span>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </header>

        {/* Chat area */}
        <ChatWindow />
      </main>
    </div>
  );
}
