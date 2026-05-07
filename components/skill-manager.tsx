"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillStatus {
  slug: string;
  status: "installing" | "installed" | "failed";
  installedAt?: Date;
  error?: string;
}

export function SkillManager({ agentId }: { agentId: string }) {
  const [slugInput, setSlugInput] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for skill status
  const { data: skillsData, mutate: refetchSkills } = useSWR<{ skills: SkillStatus[] }>(
    `/api/agents/${agentId}/skills`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: 3000, // Poll every 3 seconds
      revalidateOnFocus: false,
    }
  );

  const skills = skillsData?.skills || [];

  const handleInstallSkill = useCallback(async () => {
    if (!slugInput.trim()) {
      setError("Please enter a skill slug");
      return;
    }

    setIsInstalling(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/skills/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slugInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to install skill");
        setIsInstalling(false);
        return;
      }

      setSlugInput("");
      await refetchSkills();
    } catch (err: any) {
      setError(err.message || "Installation failed");
      setIsInstalling(false);
    }
  }, [slugInput, agentId, refetchSkills]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isInstalling) {
      handleInstallSkill();
    }
  };

  const statusIcon = (status: SkillStatus["status"]) => {
    switch (status) {
      case "installing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "installed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const statusLabel = (status: SkillStatus["status"]) => {
    switch (status) {
      case "installing":
        return "Installing...";
      case "installed":
        return "Installed";
      case "failed":
        return "Failed";
    }
  };

  return (
    <div className="space-y-6">
      {/* Installation Input */}
      <Card className="bg-secondary/50 border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Install Skills</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Add capabilities from the ClawHub registry to enhance your agent
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter skill slug (e.g., github, weather, steipete/slack)"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isInstalling}
                className="pl-9 bg-background/50"
              />
            </div>
            <Button
              onClick={handleInstallSkill}
              disabled={isInstalling || !slugInput.trim()}
              className="gap-2"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Installing
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Install
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Popular skills: github, weather, slack, linear, notion
          </p>
        </CardContent>
      </Card>

      {/* Installed Skills List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Installed Skills ({skills.length})
        </h3>

        {skills.length === 0 ? (
          <div className="rounded-lg border border-border/30 bg-secondary/20 p-6 text-center">
            <Zap className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No skills installed yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.slug}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  skill.status === "installed"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : skill.status === "failed"
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-blue-500/5 border-blue-500/20"
                )}
              >
                <div className="mt-1 shrink-0">{statusIcon(skill.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{skill.slug}</p>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-secondary text-muted-foreground">
                      {statusLabel(skill.status)}
                    </span>
                  </div>
                  {skill.installedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Installed {new Date(skill.installedAt).toLocaleDateString()}
                    </p>
                  )}
                  {skill.error && (
                    <p className="text-xs text-red-600 mt-1">{skill.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
