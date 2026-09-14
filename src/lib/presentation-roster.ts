/**
 * Parsing for the Question Bank sign-up sheet (a Google Sheet the course
 * staff maintain). Shared by the import service and its tests-by-usage in the
 * UI: pure functions only, no I/O.
 *
 * Sheet layout (one block per presentation group):
 *
 *   Group 1 | 9/15 | 1 | 林鍵鋒 | Lim Kien Hong | 109062362 | ... | Screened Coulomb forces …
 *           |      | 2 | …
 *
 * Only the header names matter; the group label and date are filled down from
 * the first row of each block.
 */

import { studentIdFromFilename } from "@/lib/report-grading";

export interface RosterEntryInput {
  studentId: string;
  name: string | null;
  englishName: string | null;
  topic: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
}

export interface RosterSummary {
  sourceUrl: string;
  importedAt: string;
  importedByName: string | null;
  entryCount: number;
  withTopicCount: number;
}

export interface RosterLookup {
  studentId: string;
  name: string | null;
  englishName: string | null;
  topic: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
}

export const ROSTER_SHEET_MAX_BYTES = 2 * 1024 * 1024;

/** RFC 4180 parser: quoted cells may contain commas, quotes ("") and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const HEADER_PATTERNS = {
  studentId: /student\s*id|學號/i,
  name: /chinese\s*name|^name$|姓名/i,
  englishName: /english\s*name/i,
  topic: /topic|題目/i,
  presentationDate: /date|日期/i,
} as const;

type HeaderKey = keyof typeof HEADER_PATTERNS;

function findColumns(row: string[]): Partial<Record<HeaderKey, number>> | null {
  const columns: Partial<Record<HeaderKey, number>> = {};
  row.forEach((cell, index) => {
    const label = cell.trim();
    for (const key of Object.keys(HEADER_PATTERNS) as HeaderKey[]) {
      if (columns[key] === undefined && HEADER_PATTERNS[key].test(label)) columns[key] = index;
    }
  });
  return columns.studentId === undefined ? null : columns;
}

function cellOrNull(row: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const value = row[index]?.replace(/\s+/g, " ").trim();
  return value ? value : null;
}

/**
 * Extracts roster entries from the sheet's CSV export. Rows without a
 * plausible student ID (5–15 digits) are skipped; the first column's group
 * label ("Group 1") and the date column are carried down through each block.
 */
export function parseRosterCsv(csv: string): RosterEntryInput[] {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) => findColumns(row) !== null);
  if (headerIndex === -1) return [];
  const columns = findColumns(rows[headerIndex])!;

  const entries: RosterEntryInput[] = [];
  const seen = new Set<string>();
  let groupLabel: string | null = null;
  let presentationDate: string | null = null;

  for (const row of rows.slice(headerIndex + 1)) {
    const leading = cellOrNull(row, 0);
    if (leading) {
      groupLabel = leading;
      presentationDate = null;
    }
    presentationDate = cellOrNull(row, columns.presentationDate) ?? presentationDate;

    const rawId = cellOrNull(row, columns.studentId);
    const studentId = rawId ? studentIdFromFilename(rawId) : null;
    if (!studentId || seen.has(studentId)) continue;
    seen.add(studentId);

    entries.push({
      studentId,
      name: cellOrNull(row, columns.name),
      englishName: cellOrNull(row, columns.englishName),
      topic: cellOrNull(row, columns.topic),
      groupLabel,
      presentationDate,
    });
  }
  return entries;
}

/**
 * Accepts a Google Sheets URL as copied from the browser and returns the CSV
 * export URL for the same tab. Rejects anything that is not a
 * docs.google.com spreadsheet so the server never fetches arbitrary hosts.
 */
export function googleSheetCsvExportUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return null;
  const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})(?:\/|$)/.exec(url.pathname);
  if (!match) return null;

  const gid =
    url.searchParams.get("gid") ??
    new URLSearchParams(url.hash.replace(/^#/, "")).get("gid") ??
    "0";
  if (!/^\d{1,12}$/.test(gid)) return null;

  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}
