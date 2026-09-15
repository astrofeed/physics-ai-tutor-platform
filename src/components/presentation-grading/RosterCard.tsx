"use client";

import React, { useState } from "react";
import { Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RosterState } from "@/hooks/usePresentationRoster";
import { DEFAULT_ROSTER_SHEET_URL } from "@/lib/presentation-roster";

function formatImportedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The Question Bank sign-up sheet used to auto-fill name and topic by student ID.
 * The course sheet is imported by default; staff only touch the link to switch sheets.
 * The page owns the roster state so the results list can offer the sheet's groups as a filter.
 */
export function RosterCard({
  roster,
  importError,
  loading,
  importing,
  importSheet,
}: RosterState) {
  const [draftUrl, setDraftUrl] = useState<string | null>(null);

  const currentUrl = roster?.sourceUrl ?? DEFAULT_ROSTER_SHEET_URL;
  const sheetUrl = draftUrl ?? currentUrl;
  const changed = sheetUrl.trim() !== currentUrl;

  const handleImport = async () => {
    if (await importSheet(sheetUrl.trim())) setDraftUrl(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sheet className="h-4 w-4 text-gray-500" />
          Question Bank sign-up sheet
        </CardTitle>
        <CardDescription>
          Already set to the course sign-up sheet — student ID, name and topic are filled in
          automatically when you type an ID or import an eeClass export. Press Refresh after new
          sign-ups; only change the link if the course uses a different sheet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            aria-label="Google Sheet link"
            value={sheetUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            maxLength={2000}
            className="text-xs"
          />
          <Button
            variant="outline"
            onClick={handleImport}
            disabled={importing || loading || sheetUrl.trim().length === 0}
            className="shrink-0"
          >
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {changed ? "Import this sheet" : "Refresh"}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {loading
            ? "Loading the sign-up sheet…"
            : roster
              ? `${roster.entryCount} students (${roster.withTopicCount} with a topic) imported ${formatImportedAt(roster.importedAt)}${roster.importedByName ? ` by ${roster.importedByName}` : ""}.${importError ? ` Could not refresh from the sheet just now: ${importError}` : " Refreshes from the sheet about once an hour."}`
              : importError
                ? `The course sheet could not be imported: ${importError}`
                : "No sheet imported yet — topics will have to be typed by hand."}
        </p>
      </CardContent>
    </Card>
  );
}
