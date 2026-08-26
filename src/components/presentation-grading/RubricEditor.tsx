"use client";

import React, { useEffect, useState } from "react";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePresentationRubric } from "@/hooks/usePresentationGrading";
import { formatTimestamp } from "./job-format";

export function RubricEditor() {
  const { rubric, loading, saving, save } = usePresentationRubric();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (rubric) setDraft(rubric.content);
  }, [rubric]);

  if (loading || !rubric) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const dirty = draft !== rubric.content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-emerald-600" />
          Shared grading rubric
        </CardTitle>
        <CardDescription>
          Saving creates version {rubric.version + 1}, used by all new jobs from everyone on the
          teaching team. Existing results keep the version they were graded with.
          {rubric.updatedAt
            ? ` Current: v${rubric.version}, saved by ${rubric.updatedByName ?? "unknown"} on ${formatTimestamp(rubric.updatedAt)}.`
            : " Current: the built-in default rubric."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={24}
          className="font-mono text-xs leading-relaxed"
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => void save(draft)} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save as new version
          </Button>
          {dirty ? (
            <Button variant="ghost" onClick={() => setDraft(rubric.content)}>
              Discard changes
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
