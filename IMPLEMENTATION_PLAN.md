# OpenClaw Skills & Telegram Integration - Implementation Plan

## Architecture Overview

Both features leverage the existing **agent_messages queue** as a command bus using the `SYS_CMD:` prefix pattern.

### System Command Flow
```
User Action → API Endpoint → agent_messages queue (role='system')
              ↓
daemon pollMessages() → Intercepts SYS_CMD → Executes locally
              ↓
daemon responses → Returns status in queue (role='system')
              ↓
UI polling → Displays confirmation
```

---

## Feature 1: ClawHub Skill Integration

### 1.1 Database Schema

The agents table already has `soul_config` column for persistence. No new columns needed initially, but we may add:
- `installed_skills` (JSON) - track installed skills for UI display
- `skill_installation_status` (TEXT) - 'pending' | 'installing' | 'installed' | 'failed'

### 1.2 UI Components

**New File: `components/skill-manager.tsx`**
- Tab-based view in the worker settings
- Search bar for ClawHub skills
- Displays:
  - Available skills from ClawHub registry (fetch via API or static list)
  - Installation status for each skill
  - "Install" button for each skill
  - Success/failure messages

**UI Flow:**
1. User enters skill slug (e.g., "github", "weather", "steipete/slack")
2. Clicks "Install Skill"
3. Component sends POST to `/api/agents/[id]/skills/install`
4. Returns immediately with status="installing"
5. UI polls `/api/agents/[id]/skills` for status updates
6. Once daemon processes, UI shows success/failure

### 1.3 API Endpoints

**`POST /api/agents/[id]/skills/install`**
- Input: `{ slug: string }`
- Validates slug format
- Inserts system message: `{ role: 'system', content: 'SYS_CMD:INSTALL_SKILL:github' }`
- Returns: `{ id: string, status: 'installing' }`

**`GET /api/agents/[id]/skills`**
- Fetches all skill-related system messages for this agent
- Filters for messages matching `SYS_CMD:INSTALL_SKILL:*` and `✅ Successfully installed skill:*`
- Returns: `{ skills: Array<{ slug, status, installedAt?, error? }> }`

### 1.4 Daemon Interception

**File: `daemon/src/managed-bootstrap.ts` - Update `pollMessages()`**

```typescript
// Inside message polling loop, before passing to OpenClaw runtime:
if (msg.role === 'system' && msg.content.startsWith('SYS_CMD:INSTALL_SKILL:')) {
  const slug = msg.content.split(':')[3];
  try {
    // Execute: npx -y clawhub install <slug> --dir ~/.openclaw/sandbox/<agent_id>
    await exec(`npx -y clawhub install ${slug} --dir ${sandboxDir}`);
    // Post success response
    await postMessage(endpoint, agentId, { role: 'system', content: `✅ Successfully installed skill: ${slug}` });
  } catch (error) {
    await postMessage(endpoint, agentId, { role: 'system', content: `❌ Skill installation failed: ${error.message}` });
  }
  continue; // Don't pass this to the LLM
}
```

---

## Feature 2: Telegram Channel Manager

### 2.1 Database Schema

**Update agents table:**
- Add `telegram_bot_token` (TEXT, nullable)
- Add `telegram_linked_at` (TIMESTAMP, nullable)

Migration command:
```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMP;
```

### 2.2 UI Components

**New File: `components/channel-manager.tsx`**
- Tab-based view alongside skills
- Visual card for Telegram with:
  - 3-step guide (BotFather instructions)
  - Masked token input field
  - Connection status indicator (connected/disconnected)
  - "Connect Channel" button
  - Option to disconnect

**UI Flow:**
1. User creates bot via BotFather on Telegram
2. Pastes token into masked input
3. Clicks "Connect Channel"
4. Component sends POST to `/api/agents/[id]/channels/telegram`
5. Backend saves token and sends system command
6. Daemon applies token to local .env and restarts agent
7. UI shows success and "Connected" badge

### 2.3 API Endpoints

**`POST /api/agents/[id]/channels/telegram`**
- Input: `{ token: string }`
- Validates token format (must be "123456:ABC-DEF...")
- Updates agents table: `telegram_bot_token = token, telegram_linked_at = NOW()`
- Inserts system message: `{ role: 'system', content: 'SYS_CMD:ENABLE_CHANNEL:TELEGRAM:<token>' }`
- Returns: `{ status: 'connected', linkedAt: string }`

**`DELETE /api/agents/[id]/channels/telegram`**
- Clears telegram_bot_token from database
- Inserts system message: `{ role: 'system', content: 'SYS_CMD:DISABLE_CHANNEL:TELEGRAM' }`
- Returns: `{ status: 'disconnected' }`

**`GET /api/agents/[id]/channels`**
- Returns: `{ telegram: { isConnected: boolean, linkedAt?: string }, ... }`

### 2.4 Daemon Interception

**File: `daemon/src/managed-bootstrap.ts` - Update `pollMessages()`**

```typescript
if (msg.role === 'system' && msg.content.startsWith('SYS_CMD:ENABLE_CHANNEL:TELEGRAM:')) {
  const token = msg.content.split(':').slice(3).join(':');
  try {
    // Write token to sandbox .env
    const envPath = join(sandboxDir, '.env');
    const envContent = `TELEGRAM_BOT_TOKEN=${token}\n`;
    await writeFile(envPath, envContent);
    
    // Signal agent to reload (exec openclaw with --restart or similar)
    // This depends on how the actual OpenClaw daemon accepts signals
    
    await postMessage(endpoint, agentId, { role: 'system', content: '📱 Telegram channel successfully linked' });
  } catch (error) {
    await postMessage(endpoint, agentId, { role: 'system', content: `❌ Telegram setup failed: ${error.message}` });
  }
  continue;
}

if (msg.role === 'system' && msg.content === 'SYS_CMD:DISABLE_CHANNEL:TELEGRAM') {
  try {
    // Remove token from sandbox .env or restart without it
    const envPath = join(sandboxDir, '.env');
    await unlink(envPath);
    await postMessage(endpoint, agentId, { role: 'system', content: '✓ Telegram channel disconnected' });
  } catch (error) {
    // Silently fail if file doesn't exist
  }
  continue;
}
```

---

## Implementation Order

### Phase 1: Database & Backend (1-2 hours)
1. Add Telegram columns to agents table
2. Create skill installation API endpoint
3. Create Telegram channel endpoints

### Phase 2: Daemon Updates (1-2 hours)
1. Update `managed-bootstrap.ts` to intercept SYS_CMD messages
2. Add skill installation logic
3. Add Telegram token management logic
4. Add helper functions for posting responses back to queue

### Phase 3: UI Components (2-3 hours)
1. Create `skill-manager.tsx` component
2. Create `channel-manager.tsx` component
3. Integrate into worker settings view
4. Add polling for status updates

### Phase 4: Testing & Polish (1-2 hours)
1. Test skill installation flow end-to-end
2. Test Telegram connection flow
3. Handle error cases and edge scenarios
4. Add user-friendly error messages

---

## Key Design Decisions

✅ **Why use agent_messages queue for commands?**
- Resilient: Commands persist in DB until processed
- Offline-friendly: Works even if daemon is sleeping
- Easy to audit: Full history visible in messages
- No new infrastructure needed

✅ **Why system messages?**
- Existing infrastructure (role='system' already supported)
- Clear separation from user/agent conversation
- Can be filtered out from chat UI

✅ **Why not WebSockets or direct bidirectional?**
- Simplicity: Works with existing polling architecture
- Reliability: No connection state to manage
- Privacy: No persistent tunnels needed

---

## Dependencies

- **ClawHub CLI**: `npx clawhub install <slug>` - user installs via daemon
- **Telegram Bot API**: Already handled by OpenClaw runtime
- **Shell execution**: Need to add `exec` utility to daemon

---

## Testing Checklist

- [ ] Install multiple skills sequentially
- [ ] Handle skill installation failure (invalid slug)
- [ ] Connect Telegram bot successfully
- [ ] Disconnect Telegram bot
- [ ] Reconnect to same bot
- [ ] Verify daemon offline behavior (commands queue correctly)
- [ ] Verify error messages display in UI
- [ ] Test with slow network (polling retries)
