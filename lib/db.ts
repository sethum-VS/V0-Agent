import { neon } from "@neondatabase/serverless";

/**
 * Neon serverless SQL client.
 * Uses DATABASE_URL from Vercel Storage integration.
 */
export const sql = neon(process.env.DATABASE_URL!);

/** Agent status enum matching the database CHECK constraint */
export type AgentStatus = "provisioning" | "awaiting_connection" | "online" | "offline";

/** Model provider type: 'system' uses the shared AI Gateway, 'byok' uses user's own key */
export type ModelProviderType = "system" | "byok";

/** Agent row type matching the agents table schema */
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  task_description: string;
  soul_config: string | null;
  status: AgentStatus;
  machine_id: string | null;
  last_heartbeat: Date | null;
  model_provider_type: ModelProviderType;
  encrypted_api_key: string | null;
  telegram_bot_token: string | null;
  telegram_linked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Message role in agent communication */
export type MessageRole = "user" | "agent" | "system";

/** Agent message row type */
export interface AgentMessage {
  id: string;
  agent_id: string;
  role: MessageRole;
  content: string;
  created_at: Date;
  is_read: boolean;
}
