# OpenClaw Daemon (managed wrapper)

This directory holds the locked-down OpenClaw build that ships to end users.

## Vendoring the upstream OpenClaw source

The Vercel sandbox cannot run `git clone`, so this needs to happen on your
local machine:

```bash
# from the repo root
git clone https://github.com/openclaw/openclaw.git daemon-upstream
rsync -a --exclude='.git' --exclude='node_modules' daemon-upstream/ daemon/
rm -rf daemon-upstream
```

After vendoring, open `daemon/src/cli.ts` and replace the body of
`runUnmanaged()` with a dynamic import of the upstream entry point (commonly
`src/index.ts` or `bin/openclaw.ts`). The `--managed` path already works
without further changes.

## Building the Mac binary

```bash
cd daemon
bun install
bun run build:binary           # arm64 (Apple Silicon)
bun run build:binary:x64       # x86_64 (Intel)
```

The compiled binary lands in `../public/openclaw-mac`, which the Next.js app
serves at `https://<your-domain>/openclaw-mac`. The binary is gitignored.

## Managed boot flow

```
openclaw --managed <agent_id> [--endpoint https://your-app/api/agents]
```

1. Creates `~/.openclaw/sandbox/<agent_id>/` and a stable `machine_id`.
2. POSTs to `{endpoint}/sync` to pull the agent's `SOUL.md` and tokens.
3. Writes the config into the sandbox (the daemon never escapes this dir).
4. Starts a 30-second heartbeat loop against `{endpoint}/heartbeat`.
