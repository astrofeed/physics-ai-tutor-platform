import type { ReportCommentCategory } from "@/lib/report-grading";

export const DEFAULT_VISIBLE_CATEGORIES: ReportCommentCategory[] = [
  "strength",
  "issue",
  "note",
];

export interface CategoryMeta {
  label: string;
  dotClass: string;
  badgeClass: string;
  activeRowClass: string;
  highlightClass: string;
  activeHighlightClass: string;
}

export const COMMENT_CATEGORY_META: Record<ReportCommentCategory, CategoryMeta> = {
  strength: {
    label: "Strength",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    activeRowClass: "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30",
    highlightClass: "bg-emerald-300/30 hover:bg-emerald-300/45",
    activeHighlightClass: "bg-emerald-300/55 ring-1 ring-emerald-500/80",
  },
  issue: {
    label: "Issue",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
    activeRowClass: "border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/30",
    highlightClass: "bg-amber-300/30 hover:bg-amber-300/45",
    activeHighlightClass: "bg-amber-300/55 ring-1 ring-amber-500/80",
  },
  note: {
    label: "Note",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    activeRowClass: "border-l-blue-500 bg-blue-50/70 dark:bg-blue-950/30",
    highlightClass: "bg-blue-300/25 hover:bg-blue-300/40",
    activeHighlightClass: "bg-blue-300/50 ring-1 ring-blue-500/80",
  },
  ai_style: {
    label: "AI-style",
    dotClass: "bg-purple-500",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    activeRowClass: "border-l-purple-500 bg-purple-50/70 dark:bg-purple-950/30",
    highlightClass: "bg-purple-300/30 hover:bg-purple-300/45",
    activeHighlightClass: "bg-purple-300/55 ring-1 ring-purple-500/80",
  },
};

export function effectiveCategory(
  category: ReportCommentCategory | null | undefined
): ReportCommentCategory {
  return category ?? "note";
}
