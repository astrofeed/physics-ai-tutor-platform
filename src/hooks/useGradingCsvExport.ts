"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/grading-csv";

/** Row-checkbox selection state for the grading job lists. */
export function useRowSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, selectAll, clear };
}

/**
 * Fetches each selected job's detail and downloads them as one CSV.
 * `endpoint` is the jobs API base (e.g. "/api/report-grading/jobs").
 */
export function useCsvExport<TDetail>(
  endpoint: string,
  filename: string,
  build: (details: TDetail[]) => string
) {
  const [exporting, setExporting] = useState(false);

  const exportIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setExporting(true);
      try {
        const details = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`${endpoint}/${id}`);
            if (!res.ok) throw new Error(`Failed to load job ${id} (${res.status})`);
            const body = await res.json();
            return body.data as TDetail;
          })
        );
        downloadCsv(filename, build(details));
        toast.success(`Exported ${details.length} result${details.length === 1 ? "" : "s"}`);
      } catch (error) {
        console.error("[grading-csv] export failed:", error);
        toast.error((error as Error).message || "CSV export failed");
      } finally {
        setExporting(false);
      }
    },
    [endpoint, filename, build]
  );

  return { exporting, exportIds };
}
