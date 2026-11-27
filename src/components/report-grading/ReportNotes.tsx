"use client";

import { MarkdownContent } from "@/components/ui/markdown-content";
import type { CSSProperties } from "react";
import type { ReportComment } from "@/lib/report-grading";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";

export type IndexedNote = { index: number; comment: ReportComment };

export function ReportNotes({ notes, active, onSelect, title, anchors }: {
  notes: IndexedNote[]; active: number | null; onSelect: (index: number) => void; title: string;
  anchors?: Map<number, number>;
}) {
  if (!notes.length) return null;
  const offset = (note: IndexedNote) => anchors?.get(note.index) ?? Infinity;
  const ordered = anchors ? [...notes].sort((a, b) => offset(a) - offset(b)) : notes;
  const firstOffset = offset(ordered[0]);
  return (
    <section aria-label={title}>
      <h3 className="h-7 text-sm font-medium">{title}</h3>
      <ol className="lg:pt-[var(--note-inset)]"
        style={{ "--note-inset": `${Number.isFinite(firstOffset) ? Math.max(0, firstOffset - 28) : 0}px` } as CSSProperties}>
        {ordered.map(({ index, comment }, i) => {
          const next = ordered[i + 1];
          const gap = next ? offset(next) - offset(ordered[i]) : 0;
          return <li key={index} className="lg:min-h-[var(--note-gap)]"
            style={{ "--note-gap": `${Number.isFinite(gap) ? gap : 0}px` } as CSSProperties}>
            <div className={`relative space-y-1 border-l-2 px-3 pb-3 text-sm focus-within:ring-2 ${active === index ? "border-foreground bg-muted" : "border-transparent"}`}>
            <button id={`report-note-${index}`} type="button" onClick={() => onSelect(index)}
              aria-pressed={active === index}
              className="text-left text-xs font-medium after:absolute after:inset-0">
              #{index + 1} · {COMMENT_CATEGORY_META[effectiveCategory(comment.category)].label}
              {comment.page ? ` · p. ${comment.page}` : ""} · {comment.reference}
            </button>
            {(comment.evidenceKind || comment.criterion || anchors || comment.needsStaffCheck) &&
              <p className="text-xs text-muted-foreground">
                {[comment.evidenceKind, comment.criterion, anchors && !anchors.has(index) ? "Page only" : null,
                  comment.needsStaffCheck ? "Needs staff review" : null].filter(Boolean).join(" · ")}
              </p>}
            {comment.quote && <p className="italic text-muted-foreground">“{comment.quote}”</p>}
            <MarkdownContent content={comment.comment} className="text-sm" />
            </div>
          </li>;
        })}
      </ol>
    </section>
  );
}
