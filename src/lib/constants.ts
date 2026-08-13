/** Activity category display labels */
export const CATEGORY_LABELS: Record<string, string> = {
  AI_CHAT: "AI Chat",
  AI_CHAT_MSG: "Chat Message",
  SUBMISSION: "Submission",
  ASSIGNMENT_VIEW: "View Assignments",
  ASSIGNMENT_SUBMIT: "Submit Work",
  GRADING: "Grading",
  SIMULATION: "Simulations",
  PROBLEM_GEN: "Problem Generator",
  ANALYTICS_VIEW: "Analytics",
  ADMIN_ACTION: "Admin",
};

/** Activity category colors for charts — theme tokens, never raw hex */
export const CATEGORY_COLORS: Record<string, string> = {
  AI_CHAT: "hsl(var(--chart-1))",
  ASSIGNMENT_VIEW: "hsl(var(--chart-2))",
  ASSIGNMENT_SUBMIT: "hsl(var(--chart-3))",
  GRADING: "hsl(var(--chart-4))",
  SIMULATION: "hsl(var(--chart-5))",
  PROBLEM_GEN: "hsl(var(--chart-2) / 0.6)",
  ANALYTICS_VIEW: "hsl(var(--chart-1) / 0.6)",
  ADMIN_ACTION: "hsl(var(--muted-foreground))",
};

export const CATEGORY_COLOR_FALLBACK = "hsl(var(--muted-foreground))";

/** Tailwind classes for role badges */
export const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PROFESSOR: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  TA: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  STUDENT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

/** Role hierarchy for permission checks */
export const ROLE_HIERARCHY: Record<string, number> = {
  STUDENT: 0,
  TA: 1,
  PROFESSOR: 2,
  ADMIN: 3,
};

/** Roles considered "staff" (non-student) */
export const STAFF_ROLES = ["TA", "PROFESSOR", "ADMIN"] as const;

/** Check if a role is a staff role (TA, PROFESSOR, or ADMIN) */
export const isStaff = (role: string): boolean =>
  STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);

/** Check if a role is ADMIN */
export const isAdmin = (role: string): boolean => role === "ADMIN";

