"use client";

import React, { useEffect, useState } from "react";
import {
  Loader2,
  Mail,
  Send,
  SkipForward,
  CheckCircle2,
  Clock,
  CalendarClock,
  FileText,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecipientPicker } from "@/components/ui/notify/recipient-picker";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { useNotifyRecipients } from "@/hooks/use-notify-recipients";
import type { UserRole } from "@/types/user";

const TEMPLATE_CATEGORIES = ["announcement", "assignment", "grade", "reminder", "general"];

export interface NotifySendContext {
  scheduledAt?: string;
  /** Roles that should see the in-app announcement — derived from the selection. */
  audienceRoles: UserRole[];
}

interface NotifyUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSubject: string;
  defaultMessage: string;
  onSkip?: (scheduledAt?: string) => void | Promise<void>;
  onSent?: () => void;
  /** Called before sending emails. Use to create a notification, etc. Returns optional assignmentId. */
  onBeforeSend?: (
    subject: string,
    message: string,
    context: NotifySendContext
  ) => Promise<string | void>;
  /** Override dialog title (default: "Notify Users") */
  dialogTitle?: string;
  /** Override dialog description */
  dialogDescription?: string;
  /** Override send button label (default: "Send Reminder") */
  sendButtonLabel?: string;
  /** Override skip button label (default: "Skip") */
  skipButtonLabel?: string;
  /** Override success message (default: "Reminder sent successfully") */
  successMessage?: string;
  /** Enable scheduling option (default: true) */
  enableScheduling?: boolean;
  /** Pre-fill the scheduled time and auto-enable schedule mode */
  defaultScheduledAt?: string;
  /** Link the scheduled email to an assignment (publishes after email sends) */
  assignmentId?: string;
  /** Called when a scheduled email is created successfully */
  onScheduled?: () => void;
  /** Schedule publish mode: shows datetime picker, always schedules email+notification */
  schedulePublishMode?: boolean;
}

/** Returns the parsed date, or null when the input is empty, malformed, or past. */
function parseFutureDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date <= new Date()) return null;
  return date;
}

function describeDelivery(result: {
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
}): string {
  const parts = [`${result.sentCount ?? 0} email${result.sentCount === 1 ? "" : "s"} sent`];
  if (result.failedCount) parts.push(`${result.failedCount} failed`);
  if (result.skippedCount) parts.push(`${result.skippedCount} skipped (banned or deleted)`);
  return parts.join(", ");
}

export function NotifyUsersDialog({
  open,
  onOpenChange,
  defaultSubject,
  defaultMessage,
  onSkip,
  onSent,
  onBeforeSend,
  dialogTitle = "Notify Users",
  dialogDescription = "Choose who gets this announcement. Selected roles decide who sees it in the app; emails are only sent when \"Also send as email\" is checked.",
  sendButtonLabel = "Send Reminder",
  skipButtonLabel = "Skip",
  successMessage = "Reminder sent successfully",
  enableScheduling = true,
  defaultScheduledAt,
  assignmentId,
  onScheduled,
  schedulePublishMode = false,
}: NotifyUsersDialogProps) {
  const recipients = useNotifyRecipients(open);
  const { templates, loading: loadingTemplates } = useEmailTemplates(open);

  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alsoEmail, setAlsoEmail] = useState(schedulePublishMode);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [successMsg, setSuccessMsg] = useState(successMessage);

  useEffect(() => {
    if (!open) {
      setSuccess(false);
      return;
    }
    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setScheduleMode(!!defaultScheduledAt);
    setScheduledAt(defaultScheduledAt || "");
    setAlsoEmail(!!defaultScheduledAt || schedulePublishMode);
    setSuccessMsg(successMessage);
  }, [open, defaultSubject, defaultMessage, defaultScheduledAt, schedulePublishMode, successMessage]);

  const { selected, selectedRoles } = recipients;
  const needsScheduledAt = schedulePublishMode || (scheduleMode && alsoEmail);
  const scheduledDate = needsScheduledAt ? parseFutureDate(scheduledAt) : null;
  const scheduledAtInvalid = needsScheduledAt && !!scheduledAt && !scheduledDate;

  const closeWithSuccess = (msg: string, onDone?: () => void) => {
    setSuccessMsg(msg);
    setSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      onDone?.();
      onSent?.();
    }, 1500);
  };

  const createScheduledEmail = async (
    date: Date,
    recipientIds: string[],
    createNotification: boolean,
    linkedAssignmentId?: string
  ) => {
    const res = await fetch("/api/admin/scheduled-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: subject.trim(),
        message: message.trim(),
        scheduledAt: date.toISOString(),
        recipientIds,
        createNotification,
        audienceRoles: selectedRoles,
        ...(linkedAssignmentId ? { assignmentId: linkedAssignmentId } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to schedule");
    }
  };

  const sendEmailsNow = async (): Promise<string> => {
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: Array.from(selected),
        subject: subject.trim(),
        message: message.trim(),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Failed to send emails");
    }
    return describeDelivery(data ?? {});
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || selected.size === 0) return;

    if (needsScheduledAt && !scheduledDate) {
      toast.error(
        scheduledAt ? "Scheduled time must be a valid future date" : "Please select a scheduled time"
      );
      return;
    }

    setSending(true);
    try {
      if (schedulePublishMode && scheduledDate) {
        let effectiveAssignmentId = assignmentId;
        const returnedId = await onBeforeSend?.(subject.trim(), message.trim(), {
          scheduledAt,
          audienceRoles: selectedRoles,
        });
        if (returnedId) effectiveAssignmentId = returnedId;

        await createScheduledEmail(
          scheduledDate,
          alsoEmail ? Array.from(selected) : [],
          true,
          effectiveAssignmentId
        );
        closeWithSuccess(
          alsoEmail
            ? `Scheduled for ${scheduledDate.toLocaleString()}`
            : `Scheduled for ${scheduledDate.toLocaleString()} — in-app notification only, no email`,
          onScheduled
        );
        return;
      }

      if (scheduleMode && alsoEmail && scheduledDate) {
        await onBeforeSend?.(subject.trim(), message.trim(), { audienceRoles: selectedRoles });
        await createScheduledEmail(scheduledDate, Array.from(selected), !onBeforeSend, assignmentId);
        closeWithSuccess(`Email scheduled for ${scheduledDate.toLocaleString()}`, onScheduled);
        return;
      }

      await onBeforeSend?.(subject.trim(), message.trim(), { audienceRoles: selectedRoles });
      const deliveryNote = alsoEmail ? await sendEmailsNow() : "In-app notification only, no email sent";
      closeWithSuccess(`${successMessage} — ${deliveryNote}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to notify users");
    } finally {
      setSending(false);
    }
  };

  const handleSkip = async () => {
    if (schedulePublishMode) {
      if (!parseFutureDate(scheduledAt)) {
        toast.error(
          scheduledAt
            ? "Scheduled time must be a valid future date"
            : "Please select a scheduled time"
        );
        return;
      }
      await onSkip?.(scheduledAt);
    } else {
      await onSkip?.();
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!sending) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-500" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-center text-gray-900 dark:text-gray-100">
              {successMsg}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4">
              {schedulePublishMode && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
                    Publish Date & Time
                  </Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    lang="en-US"
                  />
                  {scheduledDate && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Will publish on{" "}
                      {scheduledDate.toLocaleString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {scheduledAtInvalid && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Enter a valid date and time in the future.
                    </p>
                  )}
                </div>
              )}

              <RecipientPicker
                users={recipients.users}
                visibleUsers={recipients.visibleUsers}
                selected={selected}
                loading={recipients.loading}
                roleFilter={recipients.roleFilter}
                onRoleFilterChange={recipients.setRoleFilter}
                visibleSelectedCount={recipients.visibleSelectedCount}
                hiddenSelectedCount={recipients.hiddenSelectedCount}
                allVisibleSelected={recipients.allVisibleSelected}
                onToggleUser={recipients.toggleUser}
                onToggleVisible={recipients.toggleVisible}
              />

              <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                <Users className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {selectedRoles.length > 0
                    ? `In-app announcement will be visible to: ${selectedRoles.join(", ")}.`
                    : "Select at least one recipient."}
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoEmail}
                  onChange={(e) => setAlsoEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                />
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Also send as email
                  </span>
                </div>
              </label>
              {!alsoEmail && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No email will be sent — the selected roles only get the in-app notification.
                </p>
              )}

              {!schedulePublishMode && alsoEmail && (
                <>
                  {scheduleMode && defaultScheduledAt && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                      <CalendarClock className="h-4 w-4 shrink-0" />
                      <span>
                        Email will be sent on{" "}
                        {new Date(defaultScheduledAt).toLocaleString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {scheduleMode && enableScheduling && !defaultScheduledAt && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Send at
                      </Label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {scheduledAtInvalid ? (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Enter a valid date and time in the future.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Emails will be sent within 5 minutes of the scheduled time.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Use Template
                  </Label>
                  <select
                    onChange={(e) => {
                      const tmpl = templates.find((t) => t.id === e.target.value);
                      if (tmpl) {
                        setSubject(tmpl.subject);
                        setMessage(tmpl.message);
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                    disabled={loadingTemplates}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>
                      {loadingTemplates ? "Loading templates..." : "Select a template..."}
                    </option>
                    {TEMPLATE_CATEGORIES.map((cat) => {
                      const catTemplates = templates.filter((t) => t.category === cat);
                      if (catTemplates.length === 0) return null;
                      return (
                        <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                          {catTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {onSkip && (
                <Button variant="outline" onClick={handleSkip} disabled={sending}>
                  <SkipForward className="h-4 w-4 mr-2" />
                  {skipButtonLabel}
                </Button>
              )}
              <Button
                onClick={handleSend}
                disabled={
                  sending ||
                  selected.size === 0 ||
                  !subject.trim() ||
                  !message.trim() ||
                  (needsScheduledAt && !scheduledDate)
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : needsScheduledAt ? (
                  <CalendarClock className="h-4 w-4 mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {scheduleMode && alsoEmail ? "Schedule" : sendButtonLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
