"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillManifest {
  name: string;
  slug: string;
  description: string;
  author?: string;
  version?: string;
  keywords?: string[];
  repository?: string;
}

interface SkillStatus {
  slug: string;
  status: "installing" | "installed" | "failed";
  installedAt?: Date;
  error?: string;
  logs?: string[];
}

interface InstallLog {
  timestamp: Date;
  level: "info" | "error" | "success" | "warning";
  message: string;
}

export function SkillManager({ agentId }: { agentId: string }) {
  const [isMobile, setIsMobile] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [skillToPreview, setSkillToPreview] = useState<SkillManifest | null>(null);
  const [isInstallingSkill, setIsInstallingSkill] = useState(false);
  const [installLogs, setInstallLogs] = useState<InstallLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // If mobile, don't render
  if (isMobile) {
    return null;
  }

  // Poll for skill status
  const { data: skillsData, mutate: refetchSkills } = useSWR<{ skills: SkillStatus[] }>(
    `/api/agents/${agentId}/skills`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: isInstallingSkill ? 1000 : 3000, // Poll faster during install
      revalidateOnFocus: false,
    }
  );

  const skills = skillsData?.skills || [];

  // Step 1: Preview skill from ClawHub
  const handleScanSkill = useCallback(async () => {
    if (!slugInput.trim()) {
      setError("Please enter a skill slug");
      return;
    }

    setIsScanning(true);
    setError(null);
    setInstallLogs([]);

    try {
      const res = await fetch(`/api/agents/${agentId}/skills/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slugInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to scan skill");
        setIsScanning(false);
        return;
      }

      const manifest: SkillManifest = await res.json();
      setSkillToPreview(manifest);
      setShowLogs(false);
    } catch (err: any) {
      setError(err.message || "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }, [slugInput, agentId]);

  // Step 2: Install after preview accepted
  const handleConfirmInstall = useCallback(async () => {
    if (!skillToPreview) return;

    setIsInstallingSkill(true);
    setShowLogs(true);
    setInstallLogs([
      {
        timestamp: new Date(),
        level: "info",
        message: `Starting installation of ${skillToPreview.slug}...`,
      },
    ]);

    try {
      // Start installation
      const installRes = await fetch(`/api/agents/${agentId}/skills/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: skillToPreview.slug }),
      });

      if (!installRes.ok) {
        const data = await installRes.json();
        setInstallLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            level: "error",
            message: data.error || "Installation failed",
          },
        ]);
        setIsInstallingSkill(false);
        return;
      }

      const installData = await installRes.json();
      setInstallLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          level: "info",
          message: `Installation queued. Waiting for daemon response...`,
        },
      ]);

      // Poll for completion with timeout
      const maxAttempts = 120; // 2 minutes max
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const statusRes = await fetch(`/api/agents/${agentId}/skills`);
          const statusData = await statusRes.json();
          const skill = statusData.skills.find((s: SkillStatus) => s.slug === skillToPreview.slug);

          if (skill) {
            if (skill.status === "installed") {
              setInstallLogs((prev) => [
                ...prev,
                {
                  timestamp: new Date(),
                  level: "success",
                  message: `Successfully installed ${skillToPreview.slug}!`,
                },
              ]);
              clearInterval(pollInterval);
              setIsInstallingSkill(false);
              setSkillToPreview(null);
              setSlugInput("");
              await refetchSkills();
            } else if (skill.status === "failed") {
              setInstallLogs((prev) => [
                ...prev,
                {
                  timestamp: new Date(),
                  level: "error",
                  message: `Installation failed: ${skill.error || "Unknown error"}`,
                },
              ]);
              clearInterval(pollInterval);
              setIsInstallingSkill(false);
            }
          }

          if (attempts >= maxAttempts) {
            setInstallLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                level: "error",
                message: "Installation timeout (2 minutes). The daemon may not be responding.",
              },
            ]);
            clearInterval(pollInterval);
            setIsInstallingSkill(false);
          }
        } catch (err: any) {
          console.warn("Poll error:", err.message);
        }
      }, 1000);
    } catch (err: any) {
      setInstallLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          level: "error",
          message: err.message || "Installation error",
        },
      ]);
      setIsInstallingSkill(false);
    }
  }, [skillToPreview, agentId, refetchSkills]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isScanning) {
      handleScanSkill();
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
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., github, steipete/slack"
              disabled={isScanning || isInstallingSkill}
              className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <Button
              onClick={handleScanSkill}
              disabled={isScanning || !slugInput.trim() || isInstallingSkill}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Scan
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

      {/* Skill Preview Modal */}
      {skillToPreview && (
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-foreground">{skillToPreview.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{skillToPreview.slug}</p>
              </div>
              <button
                onClick={() => !isInstallingSkill && setSkillToPreview(null)}
                disabled={isInstallingSkill}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{skillToPreview.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              {skillToPreview.version && (
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p className="font-mono text-foreground">{skillToPreview.version}</p>
                </div>
              )}
              {skillToPreview.author && (
                <div>
                  <p className="text-muted-foreground">Author</p>
                  <p className="text-foreground">{skillToPreview.author}</p>
                </div>
              )}
            </div>

            {skillToPreview.keywords && skillToPreview.keywords.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {skillToPreview.keywords.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-secondary/50 rounded text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {skillToPreview.repository && (
              <a
                href={skillToPreview.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
              >
                View Repository <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {showLogs && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Installation Logs</p>
                <div className="bg-black/30 border border-border/50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {installLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex gap-2",
                        log.level === "error" && "text-red-500",
                        log.level === "success" && "text-emerald-500",
                        log.level === "warning" && "text-yellow-500",
                        log.level === "info" && "text-zinc-400"
                      )}
                    >
                      <span className="text-muted-foreground shrink-0">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  {isInstallingSkill && (
                    <div className="text-zinc-400 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Waiting for daemon...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleConfirmInstall}
                disabled={isInstallingSkill}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isInstallingSkill ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Install
                  </>
                )}
              </Button>
              <Button
                onClick={() => setSkillToPreview(null)}
                disabled={isInstallingSkill}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
