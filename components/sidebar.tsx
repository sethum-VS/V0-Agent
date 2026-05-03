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
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground">
          Command Center
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        <div className="mb-2">
          <span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Main
          </span>
        </div>
        {navigation.map((item) => (
          <a
            key={item.name}
            href="#"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              item.current
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </a>
        ))}
      </nav>

      <div className="border-t border-border p-4 space-y-2">
        {bottomNav.map((item) => (
          <a
            key={item.name}
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </a>
        ))}

        {userEmail && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {userEmail}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
