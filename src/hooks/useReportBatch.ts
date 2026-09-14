"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { lookupRosterStudent } from "@/hooks/usePresentationRoster";
import type { RosterLookup } from "@/lib/presentation-roster";
import { REPORT_BATCH_MAX_FILES, filenameStem, studentIdFromFilename } from "@/lib/report-grading";
import { parseReportZip, type ReportPackage } from "@/lib/submission-zip";

/** One report PDF waiting to be submitted, with what the grader can still correct. */
export interface ReportBatchFile {
  file: File;
  /** Zip folder the PDF came from; null for a PDF chosen directly. */
  folder: string | null;
  /** From the zip folder or filename; the grader can correct it. */
  studentId: string | null;
  /** From the zip folder or the sign-up sheet. */
  studentName: string;
  /** The presentation topic from the sign-up sheet, else the filename. */
  title: string;
  /** The sheet's "Report Topic" — the question the report must answer; blank when none. */
  assignedQuestion: string;
  groupLabel: string | null;
  presentationDate: string | null;
  /** True once the student ID was found in the sign-up sheet. */
  rosterMatched: boolean;
  /** The student ID the row was last looked up with, so a blur without a change is a no-op. */
  lookedUpId: string | null;
}

function isZip(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type.includes("zip");
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function fromPdf(file: File): ReportBatchFile {
  return {
    file,
    folder: null,
    studentId: studentIdFromFilename(file.name),
    studentName: "",
    title: filenameStem(file.name),
    assignedQuestion: "",
    groupLabel: null,
    presentationDate: null,
    rosterMatched: false,
    lookedUpId: null,
  };
}

function fromPackage(pkg: ReportPackage): ReportBatchFile {
  return {
    ...fromPdf(pkg.report),
    folder: pkg.label,
    studentId: pkg.studentId ?? studentIdFromFilename(pkg.report.name),
    studentName: pkg.studentName ?? "",
  };
}

function applyRoster(row: ReportBatchFile, roster: RosterLookup | null): ReportBatchFile {
  const lookedUpId = row.studentId?.trim() || null;
  if (!roster) {
    return { ...row, rosterMatched: false, groupLabel: null, presentationDate: null, lookedUpId };
  }
  return {
    ...row,
    lookedUpId,
    studentName: row.studentName || roster.name || "",
    title: roster.topic ?? row.title,
    assignedQuestion: roster.reportTopic ?? "",
    groupLabel: roster.groupLabel,
    presentationDate: roster.presentationDate,
    rosterMatched: true,
  };
}

/** Looks every distinct student ID up once and fills the rows from the sheet. */
async function resolveRows(rows: ReportBatchFile[]): Promise<ReportBatchFile[]> {
  const ids = Array.from(
    new Set(rows.flatMap((row) => (row.studentId?.trim() ? [row.studentId.trim()] : [])))
  );
  const lookups = new Map(
    await Promise.all(ids.map(async (id) => [id, await lookupRosterStudent(id)] as const))
  );
  return rows.map((row) =>
    applyRoster(row, row.studentId?.trim() ? lookups.get(row.studentId.trim()) ?? null : null)
  );
}

async function rowsFromArchive(archive: File): Promise<ReportBatchFile[]> {
  try {
    const packages = await parseReportZip(archive);
    if (packages.length === 0) toast.error(`No PDF found in ${archive.name}.`);
    return packages.map(fromPackage);
  } catch (error) {
    console.error(`Failed to read the report archive ${archive.name}:`, error);
    toast.error(`Could not read ${archive.name} as a .zip file.`);
    return [];
  }
}

/**
 * The batch of report PDFs being assembled: PDFs are taken as-is, zips are
 * opened in the browser (one row per PDF inside), and every row is filled in
 * from the sign-up sheet by student ID.
 */
export function useReportBatch() {
  const [files, setFiles] = useState<ReportBatchFile[]>([]);
  const [reading, setReading] = useState(false);

  const addFiles = useCallback(async (picked: File[]) => {
    setReading(true);
    try {
      const rows: ReportBatchFile[] = [];
      for (const file of picked) {
        if (isZip(file)) rows.push(...(await rowsFromArchive(file)));
        else if (isPdf(file)) rows.push(fromPdf(file));
        else toast.error(`"${file.name}" is not a PDF or .zip and was skipped.`);
      }
      const resolved = await resolveRows(rows);
      setFiles((current) => {
        const next = [...current, ...resolved];
        if (next.length > REPORT_BATCH_MAX_FILES) {
          toast.error(`At most ${REPORT_BATCH_MAX_FILES} reports per batch.`);
          next.length = REPORT_BATCH_MAX_FILES;
        }
        return next;
      });
    } finally {
      setReading(false);
    }
  }, []);

  const updateFile = useCallback((index: number, patch: Partial<ReportBatchFile>) => {
    setFiles((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  /** Re-reads name, title and question from the sheet after the grader corrects a student ID. */
  const refillFromRoster = useCallback(async (index: number) => {
    const row = files[index];
    const id = row?.studentId?.trim();
    if (!row || !id || id === row.lookedUpId) return;
    const roster = await lookupRosterStudent(id);
    setFiles((current) =>
      current.map((entry, i) =>
        i === index ? applyRoster(roster ? { ...entry, studentName: "" } : entry, roster) : entry
      )
    );
    if (!roster) toast.info(`Student ${id} is not in the sign-up sheet.`);
  }, [files]);

  const removeFile = useCallback((index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setFiles([]), []);

  return { files, reading, addFiles, updateFile, refillFromRoster, removeFile, clear };
}
