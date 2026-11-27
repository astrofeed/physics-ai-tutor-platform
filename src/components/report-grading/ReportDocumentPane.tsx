"use client";

import React, { useMemo } from "react";
import { FileText } from "lucide-react";
import type {
  ReportComment,
  ReportCommentCategory,
  ReportJobDetail,
} from "@/lib/report-grading";
import { ReportPdfViewer } from "./ReportPdfViewer";
import { ReportPair } from "./ReportSplit";
import { ReportEnd } from "./ReportEnd";
import { ReportNotes } from "./ReportNotes";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";
import { COMMENT_CATEGORIES } from "@/lib/report-grading";
import { Button } from "@/components/ui/button";

interface Props {
  sidebar: React.ReactNode;
  showNotes: boolean;
  onRead: () => void;
  job: ReportJobDetail;
  comments: ReportComment[];
  activeCommentIndex: number | null;
  onSelectComment: (index: number) => void;
  visibleCategories: Set<ReportCommentCategory>;
  onToggleCategory: (category: ReportCommentCategory) => void;
}

function renderHighlightedText(text: string, quote: string | null) {
  if (!quote || quote.trim().length < 4) return text;
  const trimmed = quote.trim();
  const normalized = text.toLowerCase();
  const quoteText = trimmed.toLowerCase();
  const idx = normalized.indexOf(quoteText);
  if (idx === -1 || normalized.indexOf(quoteText, idx + 1) !== -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200 px-0.5 text-gray-900 dark:bg-amber-500/40 dark:text-gray-50">
        {text.slice(idx, idx + trimmed.length)}
      </mark>
      {text.slice(idx + trimmed.length)}
    </>
  );
}

/**
 * Left pane of the report grading workspace: displays the retained student PDF
 * with clickable page/quote highlights, or the pasted text for text-only jobs.
 */
export function ReportDocumentPane({
  job,
  comments,
  activeCommentIndex,
  onSelectComment,
  visibleCategories,
  onToggleCategory,
  sidebar, showNotes, onRead,
}: Props) {
  const activeQuote = useMemo(() => {
    if (activeCommentIndex === null || !showNotes || !visibleCategories.has(effectiveCategory(comments[activeCommentIndex]?.category))) return null;
    return comments[activeCommentIndex]?.quote ?? null;
  }, [activeCommentIndex, comments, visibleCategories, showNotes]);

  if (job.hasReportPdf) {
    return (
      <ReportPdfViewer
        sidebar={sidebar} showNotes={showNotes} onRead={onRead}
        pdfUrl={`/api/report-grading/jobs/${job.id}/pdf`}
        filename={job.reportFilename}
        comments={comments}
        activeCommentIndex={activeCommentIndex}
        onSelectComment={onSelectComment}
        visibleCategories={visibleCategories}
        onToggleCategory={onToggleCategory}
      />
    );
  }

  const notes = comments.map((comment, index) => ({ comment, index }))
    .filter(({ comment }) => visibleCategories.has(effectiveCategory(comment.category)));
  const left = job.reportText ? (
      <div className="flex h-full flex-col bg-gray-50/70 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2.5 text-sm font-medium dark:border-gray-800">
          <FileText className="h-4 w-4 text-gray-500" />
          Pasted student report
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
          {renderHighlightedText(job.reportText, activeQuote)}
        </div>
      </div>
    ) : (
    <div className="flex h-full flex-col items-center justify-center bg-gray-50/70 p-8 text-center text-sm text-gray-500 dark:bg-gray-900/50">
      <FileText className="mb-3 h-8 w-8 text-gray-400" />
      <p className="font-medium text-gray-700 dark:text-gray-300">Report PDF not available</p>
      <p className="mt-1 max-w-sm text-xs">
        This report was graded before PDF retention was enabled. Newly uploaded reports keep
        their PDF here for side-by-side grading.
      </p>
      <Button size="sm" variant="outline" onClick={onRead}>I reviewed the original separately</Button>
    </div>
  );
  return <>
    <ReportPair left={left} right={<div className="space-y-4">{sidebar}
      {showNotes && <>
        <div className="flex flex-wrap gap-1">{COMMENT_CATEGORIES.filter(cat =>
          comments.some(c => effectiveCategory(c.category) === cat)).map(cat =>
          <Button key={cat} variant="ghost" size="sm" aria-pressed={visibleCategories.has(cat)}
            onClick={() => onToggleCategory(cat)}>{COMMENT_CATEGORY_META[cat].label}</Button>)}</div>
        <ReportNotes notes={notes} active={activeCommentIndex} onSelect={onSelectComment} title="Report notes" />
      </>}
    </div>} />
    {job.reportText && <ReportEnd onRead={onRead} />}
  </>;
}
