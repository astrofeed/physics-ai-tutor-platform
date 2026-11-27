"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useReportPdfBytes } from "@/hooks/useReportPdfBytes";
import { ReportEnd } from "./ReportEnd";
import { ReportNotes, type IndexedNote } from "./ReportNotes";
import { Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type ReportComment,
  type ReportCommentCategory,
} from "@/lib/report-grading";
import { effectiveCategory } from "./report-comment-categories";
import { ReportNoteLayers } from "./ReportNoteLayers";
import type { PdfDocLike } from "./ReportPdfPageSheet";
import { ReportPdfRow } from "./ReportPdfRow";

interface ReportPdfViewerProps {
  sidebar: React.ReactNode;
  showNotes: boolean;
  onRead: () => void;
  pdfUrl: string;
  filename: string | null;
  comments: ReportComment[];
  activeCommentIndex: number | null;
  onSelectComment: (index: number) => void;
  visibleCategories: Set<ReportCommentCategory>;
  onToggleCategory: (category: ReportCommentCategory) => void;
}

export function ReportPdfViewer({
  pdfUrl,
  filename,
  comments,
  activeCommentIndex,
  onSelectComment,
  visibleCategories,
  onToggleCategory,
  sidebar,
  showNotes,
  onRead,
}: ReportPdfViewerProps) {
  const bytes = useReportPdfBytes(pdfUrl);
  const [doc, setDoc] = useState<PdfDocLike | null>(null);
  const [multiplyTransform, setMultiplyTransform] = useState<
    ((m1: number[], m2: number[]) => number[]) | null
  >(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.05);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readyPages, setReadyPages] = useState<Set<number>>(() => new Set());
  const pageReady = useCallback((page: number) =>
    setReadyPages((prev) => prev.has(page) ? prev : new Set(prev).add(page)), []);

  useEffect(() => {
    const buffer = bytes.data;
    if (!buffer) return;
    let cancelled = false;
    let loadedDoc: PdfDocLike | null = null;

    async function load(buffer: ArrayBuffer) {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buffer.slice(0)),
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        });
        const pdf = (await loadingTask.promise) as unknown as PdfDocLike;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        loadedDoc = pdf;
        setMultiplyTransform(() => pdfjs.Util.transform);
        setDoc(pdf);
        setNumPages(pdf.numPages);
      } catch (err) {
        if (!cancelled) {
          console.error("[report-pdf-viewer] load failed:", err);
          setError((err as Error).message || "Could not render report PDF.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(buffer);
    return () => {
      cancelled = true;
      if (loadedDoc) {
        void loadedDoc.destroy();
      }
    };
  }, [bytes.data]);

  const commentsByPage = useMemo(() => {
    const map = new Map<number, { index: number; comment: ReportComment }[]>();
    comments.forEach((comment, index) => {
      const cat = effectiveCategory(comment.category);
      if (!visibleCategories.has(cat)) return;
      if (comment.page && comment.page >= 1) {
        const list = map.get(comment.page) ?? [];
        list.push({ index, comment });
        map.set(comment.page, list);
      }
    });
    return map;
  }, [comments, visibleCategories]);

  const selectNote = (index: number) => {
    onSelectComment(index);
    const page = comments[index].page;
    if (!page) return;
    const sheet = document.getElementById(`report-page-${page}`);
    const target = sheet?.querySelector<HTMLButtonElement>(`[aria-label="Jump to note #${index + 1}"]`) ?? sheet;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", inline: "nearest" });
  };
  const selectFromPdf = (index: number) => {
    onSelectComment(index);
    const note = document.getElementById(`report-note-${index}`);
    note?.focus({ preventScroll: true });
    note?.scrollIntoView({ block: "nearest" });
  };

  const toolbar = (
      <div className="space-y-2 border-b border-gray-200 bg-white/95 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-baseline gap-2">
            <p className="truncate text-sm font-medium">{filename ?? "Student report (PDF)"}</p>
            {numPages > 0 ? (
              <span className="shrink-0 text-xs text-gray-500">
                {numPages} {numPages === 1 ? "page" : "pages"}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Zoom out"
              onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.15).toFixed(2))))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
              {Math.round(scale * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Zoom in"
              onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.15).toFixed(2))))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer" aria-label="Download PDF">
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        {showNotes && <ReportNoteLayers comments={comments} visible={visibleCategories} onToggle={onToggleCategory} />}
      </div>

  );
  const pdfError = bytes.error?.message ?? error;
  const unplaced = comments.map((comment, index) => ({ comment, index })).filter(({ comment }) =>
    visibleCategories.has(effectiveCategory(comment.category)) &&
    (pdfError || !comment.page || comment.page > numPages));
  return (
    <div className="space-y-5">
      <div className="grid gap-y-4 lg:grid-cols-[var(--report-width)_minmax(0,1fr)]">
        <div className="min-w-0 lg:col-start-1 lg:pr-4">{toolbar}</div>
        <aside className="min-w-0 lg:col-start-2 lg:row-[var(--sidebar-rows)] lg:pl-4"
          style={{ "--sidebar-rows": `1 / span ${showNotes ? 1 : numPages * (numPages > 1 ? 2 : 1) + 1}` } as React.CSSProperties}>
          <div className={showNotes ? "" : "lg:sticky lg:top-12"}>{sidebar}</div>
        </aside>
        {pdfError ? (
          <div className="space-y-2 p-4 text-sm"><p role="alert">{pdfError} Check the original report before grading.</p>
            <Button variant="outline" size="sm" onClick={onRead}>I reviewed the original separately</Button></div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading report PDF…
          </div>
        ) : doc && multiplyTransform ? (
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => {
            const notes = commentsByPage.get(pageNumber) ?? EMPTY_NOTES;
            return <ReportPdfRow key={pageNumber} showNotes={showNotes} onSelectNote={selectNote}
              doc={doc}
              pageNumber={pageNumber}
              scale={scale}
              multiplyTransform={multiplyTransform}
              pageComments={showNotes ? notes : EMPTY_NOTES}
              activeCommentIndex={activeCommentIndex}
              onSelectComment={selectFromPdf}
              onReady={pageReady}
              />;
          })
        ) : null}
      </div>
      {showNotes && (!loading || pdfError) && <ReportNotes notes={unplaced} active={activeCommentIndex} onSelect={selectNote} title="Notes without a matching page" />}
      {numPages > 0 && readyPages.size === numPages && <ReportEnd onRead={onRead} />}
    </div>
  );
}

const EMPTY_NOTES: IndexedNote[] = [];
