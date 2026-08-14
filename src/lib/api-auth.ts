import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/impersonate";
import { getAccountStatus } from "@/lib/services/account-status";

export type UserRole = "STUDENT" | "TA" | "PROFESSOR" | "ADMIN";

export interface ApiUser {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  image?: string | null;
}

export interface AuthResult {
  user: ApiUser;
  session: Awaited<ReturnType<typeof getEffectiveSession>>;
}

export const BANNED_MESSAGE =
  "Your account has been suspended. Please contact an administrator.";
export const DELETED_MESSAGE =
  "Your account is no longer active. Please contact an administrator.";

/**
 * Require an authenticated user. Returns 401 JSON if not authenticated.
 *
 * The session is a JWT, so its claims are a snapshot from sign-in time. The
 * account is re-read on every call so that a deletion, a ban, or a role change
 * takes effect immediately instead of when the token expires.
 */
export async function requireApiAuth(): Promise<AuthResult | NextResponse> {
  const session = await getEffectiveSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sessionUser = session.user as ApiUser;

  const account = await getAccountStatus(sessionUser.id);
  if (!account || account.isDeleted) {
    return NextResponse.json({ error: DELETED_MESSAGE }, { status: 401 });
  }

  if (account.isBanned) {
    return NextResponse.json({ error: BANNED_MESSAGE }, { status: 403 });
  }

  const user: ApiUser = { ...sessionUser, role: account.role };
  return { user, session };
}

/**
 * Require an authenticated user with one of the given roles.
 * Returns 401 if not authenticated, 403 if wrong role.
 */
export async function requireApiRole(
  roles: UserRole[]
): Promise<AuthResult | NextResponse> {
  const result = await requireApiAuth();
  if (result instanceof NextResponse) return result;
  if (!roles.includes(result.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/** Type guard to check if the result is an error response */
export function isErrorResponse(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
