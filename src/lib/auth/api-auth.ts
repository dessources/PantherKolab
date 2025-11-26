import { cookies } from "next/headers";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "@/lib/amplify/amplify-server-utils";

/**
 * Authentication result from getAuthenticatedUser
 */
export interface AuthResult {
  userId: string;
  email?: string;
  accessToken: string;
  idToken: string;
}

/**
 * Get the authenticated user from the request context.
 * Uses Amplify server-side auth to verify the JWT token.
 *
 * @returns AuthResult if authenticated, null if not
 *
 * @example
 * ```typescript
 * const auth = await getAuthenticatedUser();
 * if (!auth) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 *  Use auth.userId for the authenticated user's ID
 * ```
 */
export async function getAuthenticatedUser(): Promise<AuthResult | null> {
  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });

    const accessToken = session.tokens?.accessToken;
    const idToken = session.tokens?.idToken;
    const userId = accessToken?.payload?.sub as string | undefined;

    if (!userId || !accessToken || !idToken) {
      return null;
    }

    return {
      userId,
      email: accessToken.payload?.email as string | undefined,
      accessToken: accessToken.toString(),
      idToken: idToken.toString(),
    };
  } catch (error) {
    console.error("[Auth] Failed to get authenticated user:", error);
    return null;
  }
}

/**
 * Verify that the provided userId matches the authenticated user.
 * Use this for endpoints where the client sends a userId in the request body.
 *
 * @param bodyUserId - The userId from the request body
 * @param authUserId - The userId from the authenticated session
 * @returns true if they match, false otherwise
 *
 * @example
 * ```typescript
 * if (!verifyUserMatch(body.senderId, auth.userId)) {
 *   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 * }
 * ```
 */
export function verifyUserMatch(
  bodyUserId: string | undefined,
  authUserId: string
): boolean {
  // If no bodyUserId provided, we'll use authUserId (safe)
  if (!bodyUserId) return true;

  return bodyUserId === authUserId;
}
