import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ROSTER_SHEET_URL,
  ROSTER_SHEET_MAX_BYTES,
  googleSheetCsvExportUrl,
  parseRosterCsv,
  rosterEntryMatchesSearch,
  rosterGroupNumbers,
  type RosterLookup,
  type RosterSearch,
  type RosterSummary,
} from "@/lib/presentation-roster";

const FETCH_TIMEOUT_MS = 15_000;

export class RosterImportError extends Error {}

async function fetchSheetCsv(exportUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(exportUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "text/csv" },
    });
  } catch {
    throw new RosterImportError("Could not reach Google Sheets. Try again in a moment.");
  }
  if (!response.ok) {
    throw new RosterImportError(
      "Google Sheets refused the download. Share the sheet as “Anyone with the link can view” and try again."
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv")) {
    throw new RosterImportError(
      "That link did not return a CSV. Share the sheet as “Anyone with the link can view” and paste the sheet URL."
    );
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > ROSTER_SHEET_MAX_BYTES) {
    throw new RosterImportError("The sheet is too large to import (2 MB limit).");
  }
  const text = await response.text();
  if (text.length > ROSTER_SHEET_MAX_BYTES) {
    throw new RosterImportError("The sheet is too large to import (2 MB limit).");
  }
  return text;
}

/** Replaces the roster with the current contents of the sign-up sheet. */
export async function importRosterFromSheet(sheetUrl: string, userId: string): Promise<RosterSummary> {
  const exportUrl = googleSheetCsvExportUrl(sheetUrl);
  if (!exportUrl) {
    throw new RosterImportError("Paste a Google Sheets link (https://docs.google.com/spreadsheets/d/…).");
  }

  const entries = parseRosterCsv(await fetchSheetCsv(exportUrl));
  if (entries.length === 0) {
    throw new RosterImportError(
      "No students found. The sheet needs a header row with “Student ID” and “Topics” columns."
    );
  }

  const roster = await prisma.$transaction(async (tx) => {
    await tx.presentationRoster.deleteMany();
    return tx.presentationRoster.create({
      data: {
        sourceUrl: sheetUrl.trim(),
        importedById: userId,
        entries: { create: entries },
      },
      include: { importedBy: { select: { name: true } } },
    });
  });

  return {
    sourceUrl: roster.sourceUrl,
    importedAt: roster.importedAt.toISOString(),
    importedByName: roster.importedBy.name,
    entryCount: entries.length,
    withTopicCount: entries.filter((entry) => entry.topic !== null).length,
    groupNumbers: rosterGroupNumbers(entries.map((entry) => entry.groupLabel)),
  };
}

export async function getRosterSummary(): Promise<RosterSummary | null> {
  const roster = await prisma.presentationRoster.findFirst({
    orderBy: { importedAt: "desc" },
    include: { importedBy: { select: { name: true } } },
  });
  if (!roster) return null;

  const [entryCount, withTopicCount, groups] = await Promise.all([
    prisma.presentationRosterEntry.count({ where: { rosterId: roster.id } }),
    prisma.presentationRosterEntry.count({ where: { rosterId: roster.id, topic: { not: null } } }),
    prisma.presentationRosterEntry.findMany({
      where: { rosterId: roster.id, groupLabel: { not: null } },
      distinct: ["groupLabel"],
      select: { groupLabel: true },
    }),
  ]);

  return {
    sourceUrl: roster.sourceUrl,
    importedAt: roster.importedAt.toISOString(),
    importedByName: roster.importedBy.name,
    entryCount,
    withTopicCount,
    groupNumbers: rosterGroupNumbers(groups.map((entry) => entry.groupLabel)),
  };
}

/**
 * The current roster, importing the course's default sign-up sheet on first use
 * so staff never have to paste it. Import failures are returned, not thrown,
 * so the page still renders and can show why the default is missing.
 */
export async function getOrImportDefaultRoster(
  userId: string
): Promise<{ roster: RosterSummary | null; importError: string | null }> {
  const existing = await getRosterSummary();
  if (existing) return { roster: existing, importError: null };

  try {
    return { roster: await importRosterFromSheet(DEFAULT_ROSTER_SHEET_URL, userId), importError: null };
  } catch (error) {
    if (error instanceof RosterImportError) return { roster: null, importError: error.message };
    throw error;
  }
}

export interface RosterSchedule {
  englishName: string | null;
  email: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
}

/** English name / email / group / date per student ID for the given IDs (from the latest roster). */
export async function rosterScheduleByStudentId(
  studentIds: string[]
): Promise<Map<string, RosterSchedule>> {
  const schedule = new Map<string, RosterSchedule>();
  if (studentIds.length === 0) return schedule;

  const entries = await prisma.presentationRosterEntry.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { roster: { importedAt: "desc" } },
    select: {
      studentId: true,
      englishName: true,
      email: true,
      groupLabel: true,
      presentationDate: true,
    },
  });
  for (const entry of entries) {
    if (!schedule.has(entry.studentId)) {
      schedule.set(entry.studentId, {
        englishName: entry.englishName,
        email: entry.email,
        groupLabel: entry.groupLabel,
        presentationDate: entry.presentationDate,
      });
    }
  }
  return schedule;
}

/** Student IDs whose roster group or presentation date is the one searched for. */
export async function rosterStudentIdsMatching(search: RosterSearch): Promise<string[]> {
  const entries = await prisma.presentationRosterEntry.findMany({
    where:
      search.kind === "group"
        ? { groupLabel: { not: null } }
        : { presentationDate: { not: null } },
    select: { studentId: true, groupLabel: true, presentationDate: true },
  });
  const ids = entries
    .filter((entry) => rosterEntryMatchesSearch(entry, search))
    .map((entry) => entry.studentId);
  return Array.from(new Set(ids));
}

export async function lookupRosterEntry(studentId: string): Promise<RosterLookup | null> {
  const entry = await prisma.presentationRosterEntry.findFirst({
    where: { studentId },
    orderBy: { roster: { importedAt: "desc" } },
    select: {
      studentId: true,
      name: true,
      englishName: true,
      topic: true,
      reportTopic: true,
      groupLabel: true,
      presentationDate: true,
    },
  });
  return entry;
}
