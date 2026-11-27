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

interface HighlightBox {
  commentIndex: number;
  category: ReportCommentCategory;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfPageLike {
  getViewport: (opts: { scale: number }) => {
    width: number;
    height: number;
    transform: number[];
  };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number; transform: number[] };
  }) => { promise: Promise<void>; cancel: () => void };
  getTextContent: () => Promise<{ items: unknown[] }>;
}

interface PdfDocLike {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPageLike>;
  destroy: () => Promise<void>;
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function findQuoteHighlights(
  items: TextItemLike[],
  commentIndex: number,
  category: ReportCommentCategory,
  quote: string | null,
  viewport: { width: number; height: number; transform: number[] },
  multiplyTransform: (m1: number[], m2: number[]) => number[]
): HighlightBox[] {
  if (!quote) return [];
  const target = normalizeForMatch(quote);
  if (target.length < 4) return [];

  let joined = "";
  const ranges: { start: number; end: number; item: TextItemLike }[] = [];
  for (const item of items) {
    const piece = normalizeForMatch(item.str);
    if (!piece) continue;
    if (joined.length > 0) joined += " ";
    const start = joined.length;
    joined += piece;
    ranges.push({ start, end: joined.length, item });
  }

  let matchIndex = joined.indexOf(target);
  let matchLen = target.length;
  if (matchIndex === -1) {
    const words = target.split(" ").filter((w) => w.length > 0);
    if (words.length >= 4) {
      const shorter = words.slice(0, Math.min(6, words.length)).join(" ");
      matchIndex = joined.indexOf(shorter);
      matchLen = shorter.length;
    }
  }
  if (matchIndex === -1) return [];

  const matchEnd = matchIndex + matchLen;
  const boxes: HighlightBox[] = [];
  for (const r of ranges) {
    if (r.end <= matchIndex || r.start >= matchEnd) continue;
    const tx = multiplyTransform(viewport.transform, r.item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]) || Math.abs(r.item.height) || 12;
    const scaleX = Math.hypot(viewport.transform[0], viewport.transform[1]) || 1;
    const widthPx = Math.max(r.item.width * scaleX, fontHeight * 0.5);
    const leftPx = tx[4];
    const topPx = tx[5] - fontHeight;
    boxes.push({
      commentIndex,
      category,
      leftPct: Math.max(0, (leftPx / viewport.width) * 100),
      topPct: Math.max(0, (topPx / viewport.height) * 100),
      widthPct: Math.min(100, (widthPx / viewport.width) * 100),
      heightPct: Math.min(100, ((fontHeight * 1.25) / viewport.height) * 100),
    });
  }
  return boxes;
}

interface PageCanvasProps {
  doc: PdfDocLike;
  pageNumber: number;
  scale: number;
  multiplyTransform: (m1: number[], m2: number[]) => number[];
  pageComments: { index: number; comment: ReportComment }[];
  activeCommentIndex: number | null;
  onSelectComment: (index: number) => void;
  registerRef: (pageNumber: number, el: HTMLDivElement | null) => void;
}

function PdfPageSheet({
  doc,
  pageNumber,
  scale,
  multiplyTransform,
  pageComments,
  activeCommentIndex,
  onSelectComment,
  registerRef,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [highlights, setHighlights] = useState<HighlightBox[]>([]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;

    async function renderPage() {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch {
        // Ignore expected cancellation when scale or page changes.
      }
      if (cancelled) return;

      const withQuotes = pageComments.filter((entry) => Boolean(entry.comment.quote));
      if (withQuotes.length > 0) {
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const textItems = textContent.items.filter(
          (item): item is TextItemLike =>
            Boolean(item && typeof item === "object" && "str" in item && "transform" in item)
        );
        const allBoxes = withQuotes.flatMap(({ index, comment }) =>
          findQuoteHighlights(
            textItems,
            index,
            effectiveCategory(comment.category),
            comment.quote,
            viewport,
            multiplyTransform
          )
        );
        setHighlights(allBoxes);
      } else {
        setHighlights([]);
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, scale, multiplyTransform, pageComments]);

  return (
    <div ref={(el) => registerRef(pageNumber, el)} data-pdf-page={pageNumber} className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-gray-500">
        <span className="tabular-nums">Page {pageNumber}</span>
        {pageComments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {pageComments.map(({ index, comment }) => {
              const cat = effectiveCategory(comment.category);
              const meta = COMMENT_CATEGORY_META[cat];
              const isActive = index === activeCommentIndex;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectComment(index)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                    isActive
                      ? meta.badgeClass
                      : "text-gray-600 hover:bg-gray-200/70 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                  #{index + 1}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto flex justify-center">
        <div className="relative inline-block bg-white shadow-sm">
          <canvas ref={canvasRef} className="block max-w-full" />
          {highlights.length > 0 ? (
            <div className="pointer-events-none absolute inset-0">
              {highlights.map((box, i) => {
                const meta = COMMENT_CATEGORY_META[box.category];
                const isActive = box.commentIndex === activeCommentIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Jump to note #${box.commentIndex + 1}`}
                    onClick={() => onSelectComment(box.commentIndex)}
                    className={cn(
                      "pointer-events-auto absolute rounded-[2px] transition-colors cursor-pointer",
                      isActive ? meta.activeHighlightClass : meta.highlightClass
                    )}
                    style={{
                      left: `${box.leftPct}%`,
                      top: `${box.topPct}%`,
                      width: `${box.widthPct}%`,
                      height: `${box.heightPct}%`,
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-gray-500 mr-0.5">Highlights:</span>
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
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? meta.badgeClass
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      active ? meta.dotClass : "bg-gray-400"
                    )}
                  />
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
            <PdfPageSheet
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
