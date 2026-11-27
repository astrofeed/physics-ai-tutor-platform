"use client";

import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useEffectiveSession } from "@/lib/effective-session-context";

const MIN = 30;
const MAX = 70;
const splitWidth = z.coerce.number().int().min(MIN).max(MAX);

export function ReportSplit({ children }: { children: React.ReactNode }) {
  const key = `report-split:${useEffectiveSession().id}`;
  const [width, setWidth] = useState(50);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const value = splitWidth.safeParse(localStorage.getItem(key));
      setWidth(value.success ? value.data : 50);
    } catch (error) { console.warn("Report layout preference unavailable", error); }
  }, [key]);

  function resize(value: number, persist: boolean) {
    const next = Math.min(MAX, Math.max(MIN, Math.round(value)));
    setWidth(next);
    if (persist) {
      try { localStorage.setItem(key, String(next)); }
      catch (error) { console.warn("Report layout preference not saved", error); }
    }
  }
  function drag(event: React.PointerEvent, persist: boolean) {
    const rect = container.current?.getBoundingClientRect();
    if (rect?.width && event.currentTarget.hasPointerCapture(event.pointerId)) {
      resize(100 * (event.clientX - rect.left) / rect.width, persist);
    }
  }
  return (
    <div ref={container} className="relative min-w-0" style={{ "--report-width": `${width}%` } as React.CSSProperties}>
      {children}
      <div className="pointer-events-none absolute inset-y-0 left-[var(--report-width)] hidden w-0 lg:block">
        <div role="separator" tabIndex={0} aria-label="Report width" aria-orientation="vertical"
          aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={width} aria-valuetext={`${width}%`}
          className="pointer-events-auto sticky top-2 flex h-[95vh] max-h-full w-5 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center focus-visible:outline-ring"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => drag(e, false)} onPointerUp={(e) => drag(e, true)}
          onKeyDown={(e) => {
            const values: Record<string, number> = { ArrowLeft: width - 2, ArrowRight: width + 2, Home: MIN, End: MAX };
            if (e.key in values) { e.preventDefault(); resize(values[e.key], true); }
          }}>
          <span className="h-full w-px bg-border" /><span className="absolute h-10 w-1 rounded-full bg-muted-foreground/60" />
        </div>
      </div>
    </div>
  );
}

export function ReportPair({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-y-3 lg:grid-cols-[var(--report-width)_minmax(0,1fr)]">
      <div className="min-w-0 lg:pr-4">{left}</div>
      {right && <div className="min-w-0 lg:pl-4">{right}</div>}
    </div>
  );
}
