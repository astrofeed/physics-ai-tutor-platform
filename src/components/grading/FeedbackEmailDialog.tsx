"use client";

import React, { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_EMAIL_MESSAGE_MAX,
  FEEDBACK_EMAIL_SUBJECT_MAX,
  FeedbackEmailInputSchema,
  type FeedbackDraft,
  type FeedbackDraftResponse,
  type FeedbackEmailInput,
} from "@/lib/feedback-email";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null while the server is still writing the draft. */
  draft: FeedbackDraftResponse | null;
  /** Prefilled recipient from the sign-up sheet; empty when unknown. */
  defaultTo: string;
  sending: boolean;
  onSend: (input: FeedbackEmailInput) => Promise<boolean>;
}

const FIELD_ERRORS: Record<string, string> = {
  to: "Enter a valid email address",
  subject: `Subject is required (up to ${FEEDBACK_EMAIL_SUBJECT_MAX} characters)`,
  message: `Message is required (up to ${FEEDBACK_EMAIL_MESSAGE_MAX.toLocaleString()} characters)`,
};

function parseForm(to: string, subject: string, message: string): FeedbackEmailInput | string {
  const parsed = FeedbackEmailInputSchema.safeParse({ to, subject, message });
  if (parsed.success) return parsed.data;
  const field = String(parsed.error.issues[0]?.path[0] ?? "");
  return FIELD_ERRORS[field] ?? "Check the form and try again";
}

/** Editable draft of the AI feedback, sent to one student address. */
export function FeedbackEmailDialog({ open, onOpenChange, draft, defaultTo, sending, onSend }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!open ? null : draft ? (
        <FeedbackEmailForm
          draft={draft.draft}
          rewritten={draft.rewritten}
          defaultTo={defaultTo}
          sending={sending}
          onSend={onSend}
          onClose={() => onOpenChange(false)}
        />
      ) : (
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Email feedback to the student</DialogTitle>
            <DialogDescription>Writing the draft from the AI feedback…</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

interface FormProps extends Omit<Props, "open" | "onOpenChange" | "draft"> {
  draft: FeedbackDraft;
  rewritten: boolean;
  onClose: () => void;
}

/** Mounted only once the draft has arrived so each opening starts from a fresh draft. */
function FeedbackEmailForm({ draft, rewritten, defaultTo, sending, onSend, onClose }: FormProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = parseForm(to, subject, message);
    if (typeof input === "string") {
      setError(input);
      return;
    }
    setError(null);
    if (await onSend(input)) onClose();
  };

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>Email feedback to the student</DialogTitle>
        <DialogDescription>
          {rewritten
            ? "A letter drafted from the AI feedback, in your name. Edit anything before sending; the student only sees the final text."
            : "The AI feedback as written for graders (no model was available to rewrite it as a letter). Please edit before sending; the student only sees the final text."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="feedback-email-to">To</Label>
          <Input
            id="feedback-email-to"
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="student@example.edu"
            autoComplete="off"
          />
          {defaultTo === "" ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No email on the sign-up sheet for this student ID — type the address.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback-email-subject">Subject</Label>
          <Input
            id="feedback-email-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={FEEDBACK_EMAIL_SUBJECT_MAX}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
          <Label htmlFor="feedback-email-message">Message</Label>
          <Textarea
            id="feedback-email-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={FEEDBACK_EMAIL_MESSAGE_MAX}
            className="min-h-[240px] flex-1 resize-y font-mono text-xs leading-relaxed sm:text-sm"
          />
          <p className="text-right text-xs text-gray-500">
            {message.length.toLocaleString()} / {FEEDBACK_EMAIL_MESSAGE_MAX.toLocaleString()}
          </p>
        </div>

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Send email
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
