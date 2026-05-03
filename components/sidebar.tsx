"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Settings,
  Activity,
  History,
  Zap,
  LogOut,
  User,
  ChevronRight,
} from "lucide-react";

const navigation = [
  { name: "Overview", icon: LayoutDashboard, current: true },
  { name: "Workers", icon: Bot, current: false },
  { name: "Activity", icon: Activity, current: false },
  { name: "History", icon: History, current: false },
];

const bottomNav = [
  { name: "Settings", icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
}

export function Sidebar({ userEmail }: SidebarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl">
      {/* Logo header */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-foreground to-foreground/80 shadow-lg shadow-white/10">
          <Zap className="h-4 w-4 text-background" />
        </div>
        <div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Command Center
          </span>
          <p className="text-[10px] text-muted-foreground">OpenClaw Agent</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-4">
        <div className="mb-3">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Main Menu
          </span>
        </div>
        {navigation.map((item) => (
          <a
            key={item.name}
            href="#"
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              item.current
                ? "bg-secondary/80 text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            {item.current && (
              <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-foreground" />
            )}
            <item.icon className={cn(
              "h-4 w-4 transition-colors",
              item.current ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {item.name}
            {item.current && (
              <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
            )}
          </a>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/50 p-4 space-y-2">
        {bottomNav.map((item) => (
          <a
            key={item.name}
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary/50 hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </a>
        ))}

        {userEmail && (
          <div className="pt-3 mt-2 border-t border-border/50">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-secondary/50 border border-border/50">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {userEmail}
                </p>
                <p className="text-[10px] text-muted-foreground">Developer</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
