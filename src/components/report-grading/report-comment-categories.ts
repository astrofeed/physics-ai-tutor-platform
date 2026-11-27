import type { ReportCommentCategory } from "@/lib/report-grading";

export const DEFAULT_VISIBLE_CATEGORIES: ReportCommentCategory[] = [
  "strength",
  "issue",
  "note",
];

export interface CategoryMeta {
  label: string;
  highlightClass: string;
  activeHighlightClass: string;
}

const STANDARD_HIGHLIGHT = {
  highlightClass: "bg-amber-200/30 hover:bg-amber-200/45",
  activeHighlightClass: "bg-amber-300/55 ring-1 ring-amber-400/70",
};

export const COMMENT_CATEGORY_META: Record<ReportCommentCategory, CategoryMeta> = {
  strength: {
    label: "Strength",
    ...STANDARD_HIGHLIGHT,
  },
  issue: {
    label: "Issue",
    ...STANDARD_HIGHLIGHT,
  },
  note: {
    label: "Note",
    ...STANDARD_HIGHLIGHT,
  },
  ai_style: {
    label: "AI-style",
    highlightClass:
      "bg-gray-300/30 border-b border-dashed border-gray-500/70 hover:bg-gray-300/45",
    activeHighlightClass:
      "bg-gray-300/55 border-b-2 border-gray-700 dark:border-gray-300",
  },
};

export function effectiveCategory(
  category: ReportCommentCategory | null | undefined
): ReportCommentCategory {
  return category ?? "note";
}
