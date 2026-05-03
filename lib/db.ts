import { neon } from "@neondatabase/serverless";

/**
 * Neon serverless SQL client.
 * Uses DATABASE_URL from Vercel Storage integration.
 */
export const sql = neon(process.env.DATABASE_URL!);

/** Agent status enum matching the database CHECK constraint */
export type AgentStatus = "provisioning" | "awaiting_connection" | "online" | "offline";

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
  created_at: Date;
  updated_at: Date;
}
