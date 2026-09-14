"use client";

import React, { useState } from "react";
import { Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePresentationRoster } from "@/hooks/usePresentationRoster";

function formatImportedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Import of the Question Bank sign-up sheet; used to auto-fill name and topic by student ID. */
export function RosterCard() {
  const { roster, loading, importing, importSheet } = usePresentationRoster();
  const [sheetUrl, setSheetUrl] = useState("");

  const handleImport = async () => {
    if (await importSheet(sheetUrl.trim() || roster?.sourceUrl || "")) setSheetUrl("");
  };
  const canImport = !importing && (sheetUrl.trim().length > 0 || roster !== null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sheet className="h-4 w-4 text-gray-500" />
          Question Bank sign-up sheet
        </CardTitle>
        <CardDescription>
          Paste the Google Sheet link (shared as “Anyone with the link can view”). Student ID,
          name and topic are then filled in automatically when you type an ID or import an
          eeClass export.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            aria-label="Google Sheet link"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            maxLength={2000}
          />
          <Button variant="outline" onClick={handleImport} disabled={!canImport} className="shrink-0">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {roster && !sheetUrl.trim() ? "Re-import" : "Import"}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {loading
            ? "Loading…"
            : roster
              ? `${roster.entryCount} students (${roster.withTopicCount} with a topic) imported ${formatImportedAt(roster.importedAt)}${roster.importedByName ? ` by ${roster.importedByName}` : ""}.`
              : "No sheet imported yet — topics will have to be typed by hand."}
        </p>
      </CardContent>
    </Card>
  );
}
