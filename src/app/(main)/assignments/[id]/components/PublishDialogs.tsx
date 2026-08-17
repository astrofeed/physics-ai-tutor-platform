"use client";

import React, { useState } from "react";
import { Loader2, AlertTriangle, CalendarClock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotifyUsersDialog } from "@/components/ui/notify-users-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AssignmentDetail } from "@/types/assignment";

interface PublishDialogsProps {
  assignment: AssignmentDetail;
  setAssignment: (a: AssignmentDetail) => void;
  unpublishDialogOpen: boolean;
  setUnpublishDialogOpen: (open: boolean) => void;
  notifyDialogOpen: boolean;
  setNotifyDialogOpen: (open: boolean) => void;
  scheduleDialogOpen: boolean;
  setScheduleDialogOpen: (open: boolean) => void;
  cancelScheduleDialogOpen: boolean;
  setCancelScheduleDialogOpen: (open: boolean) => void;
  notifySubject: string;
  notifyMessage: string;
}

export function PublishDialogs({
  assignment,
  setAssignment,
  unpublishDialogOpen,
  setUnpublishDialogOpen,
  notifyDialogOpen,
  setNotifyDialogOpen,
  scheduleDialogOpen,
  setScheduleDialogOpen,
  cancelScheduleDialogOpen,
  setCancelScheduleDialogOpen,
  notifySubject,
  notifyMessage,
}: PublishDialogsProps) {
  const router = useRouter();
  const [unpublishing, setUnpublishing] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);

  /** Throws with the server's reason — an unconfirmed AI answer key blocks this. */
  const publishAssignment = async () => {
    const res = await fetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: true }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Failed to publish assignment");
    }
    setAssignment({ ...assignment, published: true });
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    try {
      await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      setAssignment({ ...assignment, published: false });
      setUnpublishDialogOpen(false);
    } catch {
      toast.error("Failed to update assignment");
    } finally {
      setUnpublishing(false);
    }
  };

  const handleCancelSchedule = async () => {
    setCancellingSchedule(true);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledPublishAt: null, notifyOnPublish: false }),
      });
      if (res.ok) {
        setAssignment({ ...assignment, scheduledPublishAt: null, notifyOnPublish: false });
        setCancelScheduleDialogOpen(false);
        toast.success("Schedule cancelled");
      } else {
        toast.error("Failed to cancel schedule");
      }
    } catch {
      toast.error("Failed to cancel schedule");
    } finally {
      setCancellingSchedule(false);
    }
  };

  return (
    <>
      {/* Unpublish Confirmation Dialog */}
      <Dialog open={unpublishDialogOpen} onOpenChange={(open) => { if (!unpublishing) setUnpublishDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unpublish Assignment
            </DialogTitle>
            <DialogDescription>
              Unpublishing will hide this assignment from students.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnpublishDialogOpen(false)} disabled={unpublishing}>
              Cancel
            </Button>
            <Button onClick={handleUnpublish} disabled={unpublishing} variant="destructive">
              {unpublishing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish & Notify Dialog (immediate publish) */}
      <NotifyUsersDialog
        open={notifyDialogOpen}
        onOpenChange={setNotifyDialogOpen}
        defaultSubject={notifySubject}
        defaultMessage={notifyMessage}
        dialogTitle="Publish & Notify"
        dialogDescription="Select who to notify about this assignment. Optionally also send an email."
        sendButtonLabel="Notify & Publish"
        skipButtonLabel="Skip Notification & Publish"
        onSkip={async () => {
          try {
            await publishAssignment();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to publish assignment");
          }
        }}
        onBeforeSend={async (subj, msg, { audienceRoles }) => {
          await publishAssignment();
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: subj, message: msg, audienceRoles }),
          });
        }}
        onSent={() => {
          router.refresh();
        }}
      />

      {/* Schedule Publish Dialog */}
      <NotifyUsersDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        defaultSubject={notifySubject}
        defaultMessage={notifyMessage}
        schedulePublishMode
        assignmentId={assignment.id}
        dialogTitle="Schedule Publish"
        dialogDescription="Set a publish time and select who to notify when it goes live."
        sendButtonLabel="Notify & Schedule"
        skipButtonLabel="Skip Notification & Schedule"
        onBeforeSend={async (_subj, _msg, { scheduledAt }) => {
          if (!scheduledAt) return;
          const res = await fetch(`/api/assignments/${assignment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledPublishAt: scheduledAt, notifyOnPublish: true }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || "Failed to schedule");
          }
          setAssignment({ ...assignment, scheduledPublishAt: scheduledAt, notifyOnPublish: true });
          return assignment.id;
        }}
        onSkip={async (scheduledAt) => {
          if (!scheduledAt) return;
          const res = await fetch(`/api/assignments/${assignment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledPublishAt: scheduledAt, notifyOnPublish: true }),
          });
          if (res.ok) {
            setAssignment({ ...assignment, scheduledPublishAt: scheduledAt, notifyOnPublish: true });
            toast.success(`Assignment scheduled for ${new Date(scheduledAt).toLocaleString()}`);
            router.refresh();
            window.dispatchEvent(new Event("refetch-notifications"));
          } else {
            toast.error("Failed to schedule");
          }
        }}
        onSent={() => {
          toast.success("Assignment scheduled with notification");
          router.refresh();
          window.dispatchEvent(new Event("refetch-notifications"));
        }}
      />

      {/* Cancel Schedule Confirmation Dialog */}
      <Dialog open={cancelScheduleDialogOpen} onOpenChange={(open) => { if (!cancellingSchedule) setCancelScheduleDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cancel Scheduled Publish
            </DialogTitle>
            <DialogDescription>
              This will cancel the scheduled publish and any pending notification/email associated with it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelScheduleDialogOpen(false)} disabled={cancellingSchedule}>
              Keep Schedule
            </Button>
            <Button variant="destructive" disabled={cancellingSchedule} onClick={handleCancelSchedule}>
              {cancellingSchedule && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
