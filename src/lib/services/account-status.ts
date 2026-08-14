import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types/user";

export interface AccountStatus {
  role: UserRole;
  isBanned: boolean;
  isDeleted: boolean;
}

/**
 * Current account state straight from the database.
 *
 * Sessions are JWTs, so a deletion or role change made after sign-in is
 * invisible to the token until it expires. Callers must consult this instead of
 * trusting session claims.
 */
export async function getAccountStatus(
  userId: string
): Promise<AccountStatus | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isBanned: true, isDeleted: true },
  });
}
