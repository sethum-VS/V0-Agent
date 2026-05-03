import type { LucideIcon } from "lucide-react";
import { PenLine, Headphones, TrendingUp, Eye, Target } from "lucide-react";

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  githubRawUrl: string;
  /** Category tag for filtering */
  category: "marketing" | "support" | "analytics" | "monitoring";
  /** Accent color for the card */
  accentColor: "blue" | "emerald" | "amber" | "purple" | "rose";
}

/**
 * Featured agent templates from the awesome-openclaw-agents repository.
 * These are pre-configured SOUL.md files that users can one-click deploy.
 */
export const FEATURED_TEMPLATES: AgentTemplate[] = [
  {
    id: "content-writer",
    name: "Content Writer",
    description: "Generates blog posts, articles, and marketing copy with SEO optimization",
    icon: PenLine,
    githubRawUrl: "https://raw.githubusercontent.com/mergisi/awesome-openclaw-agents/main/agents/marketing/content-writer/SOUL.md",
    category: "marketing",
    accentColor: "blue",
  },
  {
    id: "customer-support",
    name: "Customer Support",
    description: "Handles tickets, answers FAQs, and escalates complex issues intelligently",
    icon: Headphones,
    githubRawUrl: "https://raw.githubusercontent.com/mergisi/awesome-openclaw-agents/main/agents/support/customer-support/SOUL.md",
    category: "support",
    accentColor: "emerald",
  },
  {
    id: "seo-analyst",
    name: "SEO Analyst",
    description: "Audits pages, suggests keywords, and tracks ranking improvements",
    icon: TrendingUp,
    githubRawUrl: "https://raw.githubusercontent.com/mergisi/awesome-openclaw-agents/main/agents/marketing/seo-analyst/SOUL.md",
    category: "analytics",
    accentColor: "amber",
  },
  {
    id: "brand-monitor",
    name: "Brand Monitor",
    description: "Scans social media and news for brand mentions and sentiment analysis",
    icon: Eye,
    githubRawUrl: "https://raw.githubusercontent.com/mergisi/awesome-openclaw-agents/main/agents/monitoring/brand-monitor/SOUL.md",
    category: "monitoring",
    accentColor: "purple",
  },
  {
    id: "competitor-watch",
    name: "Competitor Watch",
    description: "Tracks competitor pricing, features, and market positioning changes",
    icon: Target,
    githubRawUrl: "https://raw.githubusercontent.com/mergisi/awesome-openclaw-agents/main/agents/monitoring/competitor-watch/SOUL.md",
    category: "monitoring",
    accentColor: "rose",
  },
];
