/**
 * Parsing for the Question Bank sign-up sheet (a Google Sheet the course
 * staff maintain). Shared by the import service and its tests-by-usage in the
 * UI: pure functions only, no I/O.
 *
 * Sheet layout (one block per presentation group):
 *
 *   Group 1 | 9/15 | 1 | 林鍵鋒 | Lim Kien Hong | 109062362 | ... | Screened Coulomb forces … | Report Topic
 *           |      | 2 | …
 *
 * Only the header names matter; the group label and date are filled down from
 * the first row of each block. "Report Topic" is optional: when filled it is
 * the specific question the student's written report must answer.
 */

import { studentIdFromFilename } from "@/lib/report-grading";

export interface RosterEntryInput {
  studentId: string;
  name: string | null;
  englishName: string | null;
  email: string | null;
  topic: string | null;
  reportTopic: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
}

export interface RosterSummary {
  sourceUrl: string;
  importedAt: string;
  importedByName: string | null;
  entryCount: number;
  withTopicCount: number;
  /** Distinct group numbers on the sheet, ascending — the options of the results Group filter. */
  groupNumbers: number[];
}

export interface RosterLookup {
  studentId: string;
  name: string | null;
  englishName: string | null;
  topic: string | null;
  /** The question the written report must answer; null when the sheet leaves it blank. */
  reportTopic: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
}

export const ROSTER_SHEET_MAX_BYTES = 2 * 1024 * 1024;

/** The course's Question Bank sign-up sheet; imported automatically until staff point at another sheet. */
export const DEFAULT_ROSTER_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1wS5mNJc2Lzr4SECkBHwYhs_qL2AoxveqIqACmrQsCnY/edit?gid=0#gid=0";

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

/** Checked in order per cell, so "Report Topic" is claimed before the generic topic pattern sees it. */
const HEADER_PATTERNS = {
  studentId: /student\s*id|學號/i,
  name: /chinese\s*name|^name$|姓名/i,
  englishName: /english\s*name/i,
  email: /e-?mail|信箱/i,
  reportTopic: /report\s*topic|報告題目/i,
  topic: /topic|題目/i,
  presentationDate: /date|日期/i,
} as const;

type HeaderKey = keyof typeof HEADER_PATTERNS;

function findColumns(row: string[]): Partial<Record<HeaderKey, number>> | null {
  const columns: Partial<Record<HeaderKey, number>> = {};
  row.forEach((cell, index) => {
    const label = cell.trim();
    for (const key of Object.keys(HEADER_PATTERNS) as HeaderKey[]) {
      if (columns[key] === undefined && HEADER_PATTERNS[key].test(label)) {
        columns[key] = index;
        break;
      }
    }
  });
  return columns.studentId === undefined ? null : columns;
}

function cellOrNull(row: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const value = row[index]?.replace(/\s+/g, " ").trim();
  return value ? value : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailOrNull(value: string | null): string | null {
  const email = value?.toLowerCase() ?? null;
  return email && EMAIL_PATTERN.test(email) ? email : null;
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
      email: emailOrNull(cellOrNull(row, columns.email)),
      topic: cellOrNull(row, columns.topic),
      reportTopic: cellOrNull(row, columns.reportTopic),
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

export type RosterSearch =
  | { kind: "group"; number: number }
  | { kind: "date"; month: number; day: number };

/** How a grading results list is narrowed: free text and/or one roster group. */
export interface JobListFilter {
  query?: string;
  /** Roster group number (the "3" of "Group 3"); only that group's students are listed. */
  group?: number;
}

const MAX_GROUP_NUMBER = 999;

/** The `q` / `group` query parameters of a results-list request; malformed values are ignored. */
export function parseJobListFilter(searchParams: URLSearchParams): JobListFilter {
  const query = (searchParams.get("q") ?? "").trim().slice(0, 200);
  const group = Number(searchParams.get("group"));
  return {
    query: query || undefined,
    group: Number.isInteger(group) && group >= 1 && group <= MAX_GROUP_NUMBER ? group : undefined,
  };
}

/**
 * Reads a job-list search as a roster group or presentation date, so that
 * "1", "group 1" and "Group 01" find Group 1 only (not Groups 10–19) and
 * "9/5" or "09/05" find that one date. Other text is not a roster search.
 */
export function parseRosterSearch(query: string): RosterSearch | null {
  const trimmed = query.trim();
  const group = /^(?:group|第)?\s*(\d{1,3})\s*組?$/i.exec(trimmed);
  if (group) return { kind: "group", number: Number(group[1]) };
  const date = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(trimmed);
  if (date) return { kind: "date", month: Number(date[1]), day: Number(date[2]) };
  return null;
}

function firstInteger(text: string): number | null {
  const match = /\d+/.exec(text);
  return match ? Number(match[0]) : null;
}

/** Distinct group numbers behind labels such as "Group 3" / "第3組", ascending. */
export function rosterGroupNumbers(groupLabels: (string | null)[]): number[] {
  const numbers = groupLabels.flatMap((label) => (label === null ? [] : firstInteger(label) ?? []));
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

/** Whether a roster entry's group label or date is the one being searched for. */
export function rosterEntryMatchesSearch(
  entry: Pick<RosterEntryInput, "groupLabel" | "presentationDate">,
  search: RosterSearch
): boolean {
  if (search.kind === "group") {
    return entry.groupLabel !== null && firstInteger(entry.groupLabel) === search.number;
  }
  if (entry.presentationDate === null) return false;
  const parts = entry.presentationDate.split("/").map((part) => Number(part.trim()));
  return parts.length === 2 && parts[0] === search.month && parts[1] === search.day;
}
