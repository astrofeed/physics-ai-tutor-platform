"use client";

import { useState, type ComponentProps } from "react";
import { ReportPdfPageSheet } from "./ReportPdfPageSheet";
import { ReportNotes } from "./ReportNotes";

interface Props extends Omit<ComponentProps<typeof ReportPdfPageSheet>, "onAnchors"> {
  showNotes: boolean;
  onSelectNote: (index: number) => void;
}

function goToPage(page: number) {
  const sheet = document.getElementById(`report-page-${page}`);
  sheet?.focus({ preventScroll: true });
  sheet?.scrollIntoView({ block: "start" });
}

export function ReportPdfRow({ showNotes, onSelectNote, ...sheet }: Props) {
  const [anchors, setAnchors] = useState<Map<number, number>>(new Map());
  const page = sheet.pageNumber;
  return <>
    <div className="min-w-0 lg:col-start-1 lg:pr-4">
      <ReportPdfPageSheet {...sheet} onAnchors={setAnchors} />
    </div>
    {showNotes && <div className="min-w-0 lg:col-start-2 lg:pl-4">
      {sheet.pageComments.length ? <ReportNotes notes={sheet.pageComments} active={sheet.activeCommentIndex} anchors={anchors}
        onSelect={onSelectNote} title={`Page ${page} notes`} /> :
        <p className="text-xs text-muted-foreground">No visible notes on page {page}.</p>}
    </div>}
    {sheet.doc.numPages > 1 && <nav aria-label={`PDF page ${page} navigation`}
      className="flex justify-between text-xs lg:col-start-1 lg:pr-4">
      <button type="button" className="p-2 disabled:invisible" disabled={page === 1}
        onClick={() => goToPage(page - 1)}>← Previous page</button>
      <button type="button" className="p-2 disabled:invisible" disabled={page === sheet.doc.numPages}
        onClick={() => goToPage(page + 1)}>Next page →</button>
    </nav>}
  </>;
}
