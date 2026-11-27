"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReportComment, ReportCommentCategory } from "@/lib/report-grading";
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

export interface PdfPageLike {
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

export interface PdfDocLike {
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

  const matchIndex = joined.indexOf(target);
  if (matchIndex === -1 || joined.indexOf(target, matchIndex + 1) !== -1) return [];

  const matchEnd = matchIndex + target.length;
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

interface ReportPdfPageSheetProps {
  doc: PdfDocLike;
  pageNumber: number;
  scale: number;
  multiplyTransform: (m1: number[], m2: number[]) => number[];
  pageComments: { index: number; comment: ReportComment }[];
  activeCommentIndex: number | null;
  onSelectComment: (index: number) => void;
  onReady: (pageNumber: number) => void;
}

export function ReportPdfPageSheet({
  doc,
  pageNumber,
  scale,
  multiplyTransform,
  pageComments,
  activeCommentIndex,
  onSelectComment,
  onReady,
}: ReportPdfPageSheetProps) {
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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch (error) {
        if (cancelled) return;
        throw error;
      }
      if (cancelled) return;
      onReady(pageNumber);

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

    void renderPage().catch((error) => console.error("Report page render failed", pageNumber, error));
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, scale, multiplyTransform, pageComments, onReady]);

  return (
    <div id={`report-page-${pageNumber}`} tabIndex={-1} data-pdf-page={pageNumber} className="space-y-1.5 rounded bg-muted/60 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-gray-500">
        <span className="tabular-nums">Page {pageNumber}</span>
        {pageComments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {pageComments.map(({ index }) => {
              const isActive = index === activeCommentIndex;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectComment(index)}
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors",
                    isActive
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "text-gray-500 hover:bg-gray-200/70 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  #{index + 1}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div className="relative mx-auto bg-white shadow-sm" style={{ width: `${scale / 1.05 * 100}%` }}>
          <canvas ref={canvasRef} className="block h-auto w-full" />
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
