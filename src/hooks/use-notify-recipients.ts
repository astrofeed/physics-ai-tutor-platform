"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countSelected,
  selectedRoles as rolesOfSelected,
  toggleVisibleSelection,
  visibleUsersFor,
} from "@/lib/notify-selection";
import type { UserRole } from "@/types/user";

export interface NotifyUser {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  isBanned: boolean;
}

export type RoleFilter = UserRole | "ALL";

/**
 * Loads the notifiable users and tracks selection. The role filter is a view
 * filter only: selections made under one filter stay selected when the filter
 * changes, and the caller is expected to disclose the hidden ones.
 */
export function useNotifyRecipients(open: boolean) {
  const [users, setUsers] = useState<NotifyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

  useEffect(() => {
    if (!open) return;
    setRoleFilter("ALL");
    setLoading(true);

    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load users"))))
      .then((data: { users?: NotifyUser[] }) => {
        const eligible = (data.users || []).filter((u) => !u.isBanned);
        setUsers(eligible);
        setSelected(new Set(eligible.map((u) => u.id)));
      })
      .catch((error: unknown) => {
        console.error("Failed to load notification recipients:", error);
        setUsers([]);
        setSelected(new Set());
      })
      .finally(() => setLoading(false));
  }, [open]);

  const visibleUsers = useMemo(() => visibleUsersFor(users, roleFilter), [users, roleFilter]);

  const visibleSelectedCount = useMemo(
    () => countSelected(visibleUsers, selected),
    [visibleUsers, selected]
  );

  const toggleUser = useCallback((userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleVisible = useCallback(() => {
    setSelected((prev) => toggleVisibleSelection(prev, visibleUsers));
  }, [visibleUsers]);

  const selectedRoles = useMemo(() => rolesOfSelected(users, selected), [users, selected]);

  return {
    users,
    loading,
    selected,
    roleFilter,
    setRoleFilter,
    visibleUsers,
    visibleSelectedCount,
    hiddenSelectedCount: selected.size - visibleSelectedCount,
    allVisibleSelected: visibleUsers.length > 0 && visibleSelectedCount === visibleUsers.length,
    toggleUser,
    toggleVisible,
    selectedRoles,
  };
}
