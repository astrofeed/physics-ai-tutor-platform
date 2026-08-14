import type { UserRole } from "@/types/user";

export interface SelectableUser {
  id: string;
  role: UserRole;
}

/** Users the given role filter shows. `"ALL"` shows everyone. */
export function visibleUsersFor<T extends SelectableUser>(
  users: T[],
  roleFilter: UserRole | "ALL"
): T[] {
  return roleFilter === "ALL" ? users : users.filter((u) => u.role === roleFilter);
}

export function countSelected(users: SelectableUser[], selected: Set<string>): number {
  return users.filter((u) => selected.has(u.id)).length;
}

/**
 * Selects every visible user, or clears them when all are already selected.
 * Selections hidden by the role filter are never touched.
 */
export function toggleVisibleSelection(
  selected: Set<string>,
  visibleUsers: SelectableUser[]
): Set<string> {
  const next = new Set(selected);
  if (visibleUsers.length > 0 && visibleUsers.every((u) => next.has(u.id))) {
    visibleUsers.forEach((u) => next.delete(u.id));
  } else {
    visibleUsers.forEach((u) => next.add(u.id));
  }
  return next;
}

/** Roles with at least one selected user — the audience of the in-app notification. */
export function selectedRoles(users: SelectableUser[], selected: Set<string>): UserRole[] {
  const roles = new Set<UserRole>();
  users.forEach((u) => {
    if (selected.has(u.id)) roles.add(u.role);
  });
  return Array.from(roles);
}
