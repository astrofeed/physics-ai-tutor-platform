"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ReportComment } from "@/lib/report-grading";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";

const EvidenceContext = createContext<{
  open: ReadonlySet<number>;
  toggle: (index: number) => void;
} | null>(null);

export function ReportNoteEvidenceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => new Set<number>());
  const toggle = (index: number) => setOpen(previous => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });
  return <EvidenceContext.Provider value={{ open, toggle }}>{children}</EvidenceContext.Provider>;
}

export function useReportNoteEvidence() {
  const value = useContext(EvidenceContext);
  if (!value) throw new Error("Report note evidence requires its workspace provider");
  return value;
}

export function ReportNoteEvidence({ index, comment, pageOnly }: {
  index: number; comment: ReportComment; pageOnly: boolean;
}) {
  const { open, toggle } = useReportNoteEvidence();
  const expanded = open.has(index);
  const id = `report-evidence-${index}`;
  const category = COMMENT_CATEGORY_META[effectiveCategory(comment.category)].label;
  return <div className="text-sm leading-5 text-muted-foreground">
    <div className="flex flex-wrap items-baseline gap-x-3">
      <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => toggle(index)}
        className="inline-flex items-center gap-1 py-1 hover:text-foreground">
        <ChevronRight aria-hidden className={`size-3.5 ${expanded ? "rotate-90" : ""}`} />
        {category} details<span className="sr-only"> for note {index + 1}</span>
      </button>
      {(pageOnly || comment.needsStaffCheck) &&
        <span>{[pageOnly && "Page only", comment.needsStaffCheck && "Needs staff review"].filter(Boolean).join(" · ")}</span>}
    </div>
    <div id={id} hidden={!expanded} className="max-w-prose space-y-1 break-words pb-2">
      {(comment.evidenceKind || comment.criterion) && <p>{[comment.evidenceKind, comment.criterion].filter(Boolean).join(" · ")}</p>}
      {comment.reference && <p>{comment.reference}</p>}
      {comment.quote && <p>“{comment.quote}”</p>}
    </div>
  </div>;
}
