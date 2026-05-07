import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

interface ClawHubPackage {
  name: string;
  description: string;
  version: string;
  author?: {
    name?: string;
  };
  keywords?: string[];
  repository?: {
    url?: string;
  };
}

/**
 * POST /api/agents/[id]/skills/preview
 * Scan a skill on ClawHub and return manifest details
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id: agentId } = await params;

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  if (!slug) {
    return NextResponse.json({ error: "Skill slug required" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[\w\-/.]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Invalid skill slug format" },
      { status: 400 }
    );
  }

  try {
    // Fetch from ClawHub NPM registry
    // Skills are published as @clawhub/skill-{name} or user/skill-{name}
    const npmSlug = slug.includes("/") 
      ? `@${slug}` 
      : `@clawhub/skill-${slug}`;

    console.log(`[preview] Fetching ${npmSlug} from npm registry`);

    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(npmSlug)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: `Skill "${slug}" not found on ClawHub` },
          { status: 404 }
        );
      }
      throw new Error(`NPM registry returned ${res.status}`);
    }

    const pkg = (await res.json()) as { 
      "dist-tags": { latest: string };
      versions: Record<string, ClawHubPackage>;
    };

    const latestVersion = pkg["dist-tags"].latest;
    const manifest = pkg.versions[latestVersion];

    if (!manifest) {
      return NextResponse.json(
        { error: "Could not parse skill manifest" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      name: manifest.name || slug,
      slug: slug,
      description: manifest.description || "No description available",
      version: manifest.version,
      author: manifest.author?.name,
      keywords: manifest.keywords,
      repository: manifest.repository?.url?.replace("+ssh://git@github.com/", "https://github.com/").replace(".git", ""),
    });
  } catch (error: any) {
    console.error("[preview] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to scan skill: " + error.message },
      { status: 500 }
    );
  }
}
