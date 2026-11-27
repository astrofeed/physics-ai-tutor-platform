"use client";

import { MarkdownContent } from "@/components/ui/markdown-content";
import type { ReportComment } from "@/lib/report-grading";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";

export type IndexedNote = { index: number; comment: ReportComment };

export function ReportNotes({ notes, active, onSelect, title }: {
  notes: IndexedNote[]; active: number | null; onSelect: (index: number) => void; title: string;
}) {
  if (!notes.length) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ol className="divide-y">
        {notes.map(({ index, comment }) => (
          <li key={index} className={`relative space-y-1 border-l-2 p-3 text-sm focus-within:ring-2 ${active === index ? "border-foreground bg-muted" : "border-transparent"}`}>
            <button id={`report-note-${index}`} type="button" onClick={() => onSelect(index)}
              aria-pressed={active === index}
              className="text-left text-xs font-medium after:absolute after:inset-0">
              #{index + 1} · {COMMENT_CATEGORY_META[effectiveCategory(comment.category)].label}
              {comment.page ? ` · p. ${comment.page}` : ""} · {comment.reference}
            </button>
            {comment.quote && <p className="italic text-muted-foreground">“{comment.quote}”</p>}
            <MarkdownContent content={comment.comment} className="text-sm" />
          </li>
        ))}
      </ol>
    </section>
  );
}
