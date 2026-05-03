import { cookies } from "next/headers";

/**
 * Retrieves the current authenticated user from session.
 *
 * This is a placeholder implementation. In production, integrate with your
 * auth provider (e.g., Stack Auth once STACK_* env vars are configured,
 * or NextAuth, Clerk, etc.).
 *
 * For now, we read a `user_id` cookie set during login.
 * Returns null if no authenticated session exists.
 */
export async function getCurrentUser(): Promise<{ id: string; email?: string } | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;

  if (!userId) {
    return null;
  }

  return { id: userId };
}

/**
 * Requires authentication or throws an error.
 * Use in Server Actions and API routes that need user scoping.
 */
export async function requireAuth(): Promise<{ id: string; email?: string }> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: No authenticated user");
  }

  return user;
}
