import { COMMENT_CATEGORIES, type ReportComment, type ReportCommentCategory } from "@/lib/report-grading";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";

interface Props {
  comments: ReportComment[];
  visible: Set<ReportCommentCategory>;
  onToggle: (category: ReportCommentCategory) => void;
}

export function ReportNoteLayers({ comments, visible, onToggle }: Props) {
  const counts = new Map<ReportCommentCategory, number>();
  for (const comment of comments) {
    const category = effectiveCategory(comment.category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return <div role="group" aria-label="Highlight layers" className="text-sm text-muted-foreground">
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1">Highlights:</span>
      {COMMENT_CATEGORIES.map(category => {
        const count = counts.get(category) ?? 0;
        if (!count && category !== "ai_style") return null;
        return <button key={category} type="button" aria-pressed={visible.has(category)}
          onClick={() => onToggle(category)}
          className="rounded px-2 py-1 hover:bg-muted aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:underline">
          {COMMENT_CATEGORY_META[category].label} ({count})
        </button>;
      })}
    </div>
    {visible.has("ai_style") && <p className="mt-1" role="status">
      {!counts.has("ai_style") && "No AI-style passages were annotated in this review. "}
      Writing-style notes are not evidence of AI use and do not affect scores.
    </p>}
  </div>;
}
