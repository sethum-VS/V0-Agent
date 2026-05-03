"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkerStatus = "Idle" | "Thinking" | "Completed";

interface WorkerCardProps {
  name: string;
  task: string;
  status: WorkerStatus;
}

const statusConfig: Record<
  WorkerStatus,
  { color: string; bgColor: string; dotColor: string }
> = {
  Idle: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    dotColor: "bg-muted-foreground",
  },
  Thinking: {
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    dotColor: "bg-amber-400",
  },
  Completed: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    dotColor: "bg-emerald-400",
  },
};

export function WorkerCard({ name, task, status }: WorkerCardProps) {
  const config = statusConfig[status];

  return (
    <Card className="group transition-colors hover:border-muted-foreground/50">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-base font-medium">{name}</CardTitle>
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
        <p className="line-clamp-2 text-sm text-muted-foreground">{task}</p>
        <Badge
          variant="secondary"
          className={cn("gap-1.5 border-0", config.bgColor, config.color)}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              config.dotColor,
              status === "Thinking" && "animate-pulse"
            )}
          />
          {status}
        </Badge>
      </CardContent>
    </Card>
  );
}
