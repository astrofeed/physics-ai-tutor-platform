"use client";

import React, { useEffect, useState } from "react";
import { BookOpenCheck, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Textarea } from "@/components/ui/textarea";
import { useReportRubric, useReportRubricHistory } from "@/hooks/useReportGrading";
import { formatTimestamp } from "./report-job-format";

export function ReportRubricEditor() {
  const { rubric, loading, saving, save } = useReportRubric();
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const history = useReportRubricHistory();

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
          Shared grading instructions
        </CardTitle>
        <CardDescription>
          Saving creates version {rubric.version + 1}, used by all new jobs from everyone on the
          teaching team. Existing results keep the version they were graded with.
          {rubric.updatedAt
            ? ` Current: v${rubric.version}, saved by ${rubric.updatedByName ?? "unknown"} on ${formatTimestamp(rubric.updatedAt)}.`
            : " Current: the built-in default instructions."}
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
          <Button
            onClick={async () => {
              const saved = await save(draft);
              if (saved && history.versions !== null) void history.load();
            }}
            disabled={!dirty || saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save as new version
          </Button>
          {dirty ? (
            <Button variant="ghost" onClick={() => setDraft(rubric.content)}>
              Discard changes
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              const next = !showHistory;
              setShowHistory(next);
              if (next && history.versions === null) void history.load();
            }}
          >
            <History className="mr-1.5 h-4 w-4" />
            {showHistory ? "Hide history" : "Version history"}
          </Button>
        </div>
        {showHistory ? (
          history.loading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              {(history.versions ?? []).map((version) => (
                <li key={version.version} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    v{version.version}
                    {version.version === rubric.version ? (
                      <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">current</span>
                    ) : null}
                    <span className="ml-2 text-gray-500">
                      {version.updatedByName ?? "unknown"} · {formatTimestamp(version.updatedAt)}
                    </span>
                  </span>
                  {version.version !== rubric.version || dirty ? (
                    <Button variant="ghost" size="sm" onClick={() => setDraft(version.content)}>
                      Load into editor
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
