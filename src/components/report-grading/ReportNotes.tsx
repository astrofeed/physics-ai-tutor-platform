"use client";

import { MarkdownContent } from "@/components/ui/markdown-content";
import type { CSSProperties } from "react";
import type { ReportComment } from "@/lib/report-grading";
import { ReportNoteEvidence } from "./ReportNoteEvidence";

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
            <div className={`border-l-2 px-2 pb-4 ${active === index ? "border-foreground" : "border-transparent"}`}>
              <div className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-1">
                <button id={`report-note-${index}`} type="button" onClick={() => onSelect(index)}
                  aria-label={`Locate note ${index + 1} in the report`} aria-pressed={active === index}
                  className="text-left text-sm leading-6 text-muted-foreground after:absolute after:inset-0 after:z-10 hover:underline">#{index + 1}</button>
                <MarkdownContent content={comment.comment}
                  className="max-w-prose text-base leading-6 [&_:is(h1,h2,h3,h4,h5,h6)]:text-base [&_:is(h1,h2,h3,h4,h5,h6,strong)]:font-medium [&_em]:not-italic [&_:is(a,button,.katex)]:relative [&_:is(a,button,.katex)]:z-[11]" />
              </div>
              <div className="pl-8"><ReportNoteEvidence index={index} comment={comment} pageOnly={!!anchors && !anchors.has(index)} /></div>
            </div>
          </li>;
        })}
      </ol>
    </section>
  );
}
