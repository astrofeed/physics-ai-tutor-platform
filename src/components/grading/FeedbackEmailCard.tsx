"use client";

import React, { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackEmailDialog } from "@/components/grading/FeedbackEmailDialog";
import { formatTimestamp } from "@/components/presentation-grading/job-format";
import { useFeedbackEmail } from "@/hooks/useFeedbackEmail";
import type { HumanGradingKind } from "@/hooks/useHumanGrading";
import type { FeedbackDraftResponse, FeedbackEmailStatus } from "@/lib/feedback-email";

interface Props {
  kind: HumanGradingKind;
  jobId: string;
  status: FeedbackEmailStatus;
  onChanged: () => void;
}

/**
 * Lets staff forward the AI feedback to the student, showing when it last went
 * out. The draft is written server-side when the dialog opens (a model turns
 * the grader-facing result into a letter), so each opening starts fresh.
 */
export function FeedbackEmailCard({ kind, jobId, status, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraftResponse | null>(null);
  const { loadDraft, send, sending } = useFeedbackEmail(kind, jobId, onChanged);
  const sentBefore = status.feedbackSentAt !== null;

  const openDialog = async () => {
    setDraft(null);
    setOpen(true);
    const loaded = await loadDraft();
    if (loaded) setDraft(loaded);
    else setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-gray-500" />
          Email feedback to the student
        </CardTitle>
        <Button
          size="sm"
          variant={sentBefore ? "outline" : "default"}
          onClick={() => void openDialog()}
        >
          <Mail className="mr-1.5 h-4 w-4" />
          {sentBefore ? "Send again" : "Email student"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <p>
          {sentBefore
            ? `Sent to ${status.feedbackSentTo} on ${formatTimestamp(status.feedbackSentAt)}.`
            : "Not sent yet. Opens an editable letter drafted from the AI feedback."}
        </p>
        <p className="text-xs">
          {status.studentEmail
            ? `Sign-up sheet email: ${status.studentEmail}`
            : "No email on the sign-up sheet for this student ID — you can type one in the dialog."}
        </p>
      </CardContent>

      <FeedbackEmailDialog
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        defaultTo={status.studentEmail ?? ""}
        sending={sending}
        onSend={send}
      />
    </Card>
  );
}
