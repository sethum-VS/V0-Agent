"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TelegramStatus {
  isConnected: boolean;
  linkedAt?: string;
}

export function ChannelManager({ agentId }: { agentId: string }) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Poll for Telegram connection status
  const { data: channelsData, mutate: refetchChannels } = useSWR<{ telegram: TelegramStatus }>(
    `/api/agents/${agentId}/channels/telegram`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: false,
    }
  );

  const telegram = channelsData?.telegram || { isConnected: false };

  const handleConnect = useCallback(async () => {
    if (!token.trim()) {
      setError("Please enter a bot token");
      return;
    }

    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      setError("Invalid token format (should be 123456:ABC-DEF...)");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/channels/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to connect Telegram");
        setIsConnecting(false);
        return;
      }

      setToken("");
      setSuccess("Telegram channel connected successfully!");
      await refetchChannels();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Connection failed");
      setIsConnecting(false);
    }
  }, [token, agentId, refetchChannels]);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm("Disconnect Telegram? Your agent will no longer receive messages via Telegram.")) {
      return;
    }

    setIsDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/channels/telegram`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to disconnect Telegram");
        setIsDisconnecting(false);
        return;
      }

      setSuccess("Telegram channel disconnected");
      await refetchChannels();
      
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || "Disconnection failed");
    } finally {
      setIsDisconnecting(false);
    }
  }, [agentId, refetchChannels]);

  const copyCommand = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isConnecting && !telegram.isConnected) {
      handleConnect();
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={cn(
        "border transition-colors",
        telegram.isConnected
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-secondary/50 border-border/50"
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className={cn(
                "h-5 w-5",
                telegram.isConnected ? "text-emerald-500" : "text-muted-foreground"
              )} />
              <h3 className="font-semibold text-foreground">Telegram</h3>
            </div>
            {telegram.isConnected && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600">Connected</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!telegram.isConnected ? (
            <>
              {/* Setup Instructions */}
              <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Setup Instructions
                </h4>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-semibold text-foreground min-w-fit">1.</span>
                    <span>Open Telegram and message <code className="bg-secondary px-2 py-1 rounded text-xs font-mono">@BotFather</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-foreground min-w-fit">2.</span>
                    <span>Send <code className="bg-secondary px-2 py-1 rounded text-xs font-mono">/newbot</code> and follow the prompts</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-foreground min-w-fit">3.</span>
                    <span>Copy the bot token and paste it below</span>
                  </li>
                </ol>
              </div>

              {/* Token Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bot Token
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="123456:ABC-DEF1234567890..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isConnecting}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                    className="px-3"
                  >
                    {showToken ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-600">{success}</p>
                </div>
              )}

              <Button
                onClick={handleConnect}
                disabled={isConnecting || !token.trim()}
                className="w-full gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" />
                    Connect Telegram
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Connected State */}
              <div className="space-y-3">
                <div className="bg-background/50 rounded-lg p-3 border border-emerald-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Connected since</p>
                  <p className="font-mono text-sm text-foreground">
                    {telegram.linkedAt ? new Date(telegram.linkedAt).toLocaleString() : "Unknown"}
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Your agent is now receiving and responding to messages via Telegram. Users can interact with your agent directly through the bot.
                </p>

                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full gap-2"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="h-4 w-4" />
                      Disconnect Telegram
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
