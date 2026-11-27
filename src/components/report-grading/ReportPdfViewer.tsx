"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  COMMENT_CATEGORIES,
  type ReportComment,
  type ReportCommentCategory,
} from "@/lib/report-grading";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";
import { ReportPdfPageSheet, type PdfDocLike } from "./ReportPdfPageSheet";

interface ReportPdfViewerProps {
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
}: ReportPdfViewerProps) {
  const [doc, setDoc] = useState<PdfDocLike | null>(null);
  const [multiplyTransform, setMultiplyTransform] = useState<
    ((m1: number[], m2: number[]) => number[]) | null
  >(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.05);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PdfDocLike | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(pdfUrl, { credentials: "include" });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Report PDF is no longer stored."
              : `Failed to load PDF (${res.status}).`
          );
        }
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buffer),
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

    void load();
    return () => {
      cancelled = true;
      if (loadedDoc) {
        void loadedDoc.destroy();
      }
    };
  }, [pdfUrl]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ReportCommentCategory, number>();
    for (const c of comments) {
      const cat = effectiveCategory(c.category);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [comments]);

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

  useEffect(() => {
    if (activeCommentIndex === null) return;
    const page = comments[activeCommentIndex]?.page;
    if (!page) return;
    const target = pageRefs.current.get(page);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeCommentIndex, comments]);

  const registerRef = (pageNumber: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(pageNumber, el);
    else pageRefs.current.delete(pageNumber);
  };

  return (
    <div className="flex h-full flex-col bg-gray-100/80 dark:bg-gray-900/50 rounded-lg overflow-hidden">
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

        {comments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-[11px] text-gray-500 mr-1">Highlights:</span>
            {COMMENT_CATEGORIES.map((cat) => {
              const count = categoryCounts.get(cat) ?? 0;
              if (count === 0) return null;
              const active = visibleCategories.has(cat);
              const meta = COMMENT_CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleCategory(cat)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading report PDF…
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-amber-800 dark:text-amber-200">{error}</p>
        ) : doc && multiplyTransform ? (
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
            <ReportPdfPageSheet
              key={pageNumber}
              doc={doc}
              pageNumber={pageNumber}
              scale={scale}
              multiplyTransform={multiplyTransform}
              pageComments={commentsByPage.get(pageNumber) ?? []}
              activeCommentIndex={activeCommentIndex}
              onSelectComment={onSelectComment}
              registerRef={registerRef}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}
