import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";

export interface User {
  id: string;
  email: string;
}

/**
 * Retrieves the current authenticated user from session.
 * Reads the user_id cookie and fetches the user from the database.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;

  if (!userId) {
    // In non-production, return a deterministic dev user for testing
    if (process.env.NODE_ENV !== "production") {
      return { id: "dev-user-00000000", email: "dev@localhost" };
    }
    return null;
  }

  // Fetch user from database
  const users = await sql<{ id: string; email: string }[]>`
    SELECT id, email FROM users WHERE id = ${userId}
  `;

  if (users.length === 0) {
    return null;
  }

  return users[0];
}

/**
 * Requires authentication or throws an error.
 * Use in Server Actions and API routes that need user scoping.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: No authenticated user");
  }

  return user;
}

/**
 * Requires authentication or redirects to sign-in page.
 * Use in Server Components (pages) to protect routes.
 */
export async function requireAuthOrRedirect(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
