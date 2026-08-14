"use client";

import { Info, Loader2 } from "lucide-react";
import type { UserRole } from "@/types/user";
import type { NotifyUser, RoleFilter } from "@/hooks/use-notify-recipients";

const ROLES: UserRole[] = ["STUDENT", "TA", "PROFESSOR", "ADMIN"];
const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Students",
  TA: "TAs",
  PROFESSOR: "Professors",
  ADMIN: "Admins",
};
const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  PROFESSOR: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  TA: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  STUDENT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
};

const TAB_BASE =
  "px-3 py-1 rounded-full text-xs font-medium border transition-colors";
const TAB_ACTIVE =
  "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800";
const TAB_IDLE =
  "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800";

interface RecipientPickerProps {
  users: NotifyUser[];
  visibleUsers: NotifyUser[];
  selected: Set<string>;
  loading: boolean;
  roleFilter: RoleFilter;
  onRoleFilterChange: (filter: RoleFilter) => void;
  visibleSelectedCount: number;
  hiddenSelectedCount: number;
  allVisibleSelected: boolean;
  onToggleUser: (userId: string) => void;
  onToggleVisible: () => void;
}

export function RecipientPicker({
  users,
  visibleUsers,
  selected,
  loading,
  roleFilter,
  onRoleFilterChange,
  visibleSelectedCount,
  hiddenSelectedCount,
  allVisibleSelected,
  onToggleUser,
  onToggleVisible,
}: RecipientPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Recipients ({visibleSelectedCount} of {visibleUsers.length} shown selected
          {roleFilter === "ALL" ? "" : `, ${selected.size} total`})
        </span>
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          onClick={onToggleVisible}
        >
          {allVisibleSelected ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onRoleFilterChange("ALL")}
          className={`${TAB_BASE} ${roleFilter === "ALL" ? TAB_ACTIVE : TAB_IDLE}`}
        >
          All ({users.length})
        </button>
        {ROLES.map((role) => {
          const count = users.filter((u) => u.role === role).length;
          if (count === 0) return null;
          return (
            <button
              key={role}
              type="button"
              onClick={() => onRoleFilterChange(role)}
              className={`${TAB_BASE} ${roleFilter === role ? TAB_ACTIVE : TAB_IDLE}`}
            >
              {ROLE_LABELS[role]} ({count})
            </button>
          );
        })}
      </div>

      {hiddenSelectedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {hiddenSelectedCount === 1
              ? "1 selected recipient in another role is hidden by this filter and will still be included."
              : `${hiddenSelectedCount} selected recipients in other roles are hidden by this filter and will still be included.`}{" "}
            Switch to All to review or deselect them.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="border rounded-lg divide-y dark:border-gray-700 dark:divide-gray-700 max-h-[200px] overflow-y-auto">
          {visibleUsers.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(user.id)}
                onChange={() => onToggleUser(user.id)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 shrink-0"
              />
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {user.name || "Unknown"}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[user.role]}`}
              >
                {user.role}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-auto">
                {user.email}
              </span>
            </label>
          ))}
          {visibleUsers.length === 0 && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
