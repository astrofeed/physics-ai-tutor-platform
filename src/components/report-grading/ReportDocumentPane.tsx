"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { FileText } from "lucide-react";
import type { ReportComment, ReportJobDetail } from "@/lib/report-grading";
import { ReportPdfViewer } from "./ReportPdfViewer";

interface Props {
  job: ReportJobDetail;
  comments: ReportComment[];
  activeCommentIndex: number | null;
  onSelectComment: (index: number) => void;
}

function PastedReportPane({
  text,
  activeQuote,
}: {
  text: string;
  activeQuote: string | null;
}) {
  const markRef = useRef<HTMLElement | null>(null);

  const parts = useMemo(() => {
    if (!activeQuote || activeQuote.trim().length < 4) return null;
    const needle = activeQuote.trim();
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx === -1) return null;
    return {
      before: text.slice(0, idx),
      match: text.slice(idx, idx + needle.length),
      after: text.slice(idx + needle.length),
    };
  }, [text, activeQuote]);

  useEffect(() => {
    if (parts && markRef.current) {
      markRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [parts]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 text-sm font-medium dark:border-gray-800">
        <FileText className="h-4 w-4 text-gray-500" />
        Student report (pasted text)
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words font-serif">
        {parts ? (
          <>
            {parts.before}
            <mark
              ref={markRef}
              className="rounded bg-amber-200/80 px-0.5 text-gray-950 dark:bg-amber-500/40 dark:text-amber-50"
            >
              {parts.match}
            </mark>
            {parts.after}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

/** Left column of the report grading workspace: PDF viewer, pasted text, or legacy notice. */
export function ReportDocumentPane({
  job,
  comments,
  activeCommentIndex,
  onSelectComment,
}: Props) {
  if (job.hasReportPdf) {
    return (
      <ReportPdfViewer
        pdfUrl={`/api/report-grading/jobs/${job.id}/pdf`}
        filename={job.reportFilename}
        comments={comments}
        activeCommentIndex={activeCommentIndex}
        onSelectComment={onSelectComment}
      />
    );
  }

  if (job.reportText) {
    const activeQuote =
      activeCommentIndex !== null ? comments[activeCommentIndex]?.quote ?? null : null;
    return <PastedReportPane text={job.reportText} activeQuote={activeQuote} />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40">
      <FileText className="mb-2 h-8 w-8 text-gray-400" />
      <p className="font-medium text-gray-700 dark:text-gray-300">
        Report file not retained for this job
      </p>
      <p className="mt-1 max-w-sm text-xs">
        This report was graded before side-by-side PDF retention was enabled. Re-upload and
        regrade the PDF to view it beside the AI notes.
      </p>
    </div>
  );
}
