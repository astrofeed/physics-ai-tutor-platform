"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deletePresentationJob,
  updatePresentationJob,
} from "@/hooks/usePresentationGrading";

interface JobActionsProps {
  jobId: string;
  topic: string;
  presenters: string | null;
  studentIds: string | null;
  onUpdated: () => void;
}

/** Edit (topic / presenter names) and delete controls for one grading job. */
export function JobActions({ jobId, topic, presenters, studentIds, onUpdated }: JobActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [draftTopic, setDraftTopic] = useState(topic);
  const [draftPresenters, setDraftPresenters] = useState(presenters ?? "");
  const [draftStudentIds, setDraftStudentIds] = useState(studentIds ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEdit = (open: boolean) => {
    if (open) {
      setDraftTopic(topic);
      setDraftPresenters(presenters ?? "");
      setDraftStudentIds(studentIds ?? "");
    }
    setEditOpen(open);
  };

  const handleSave = async () => {
    const nextTopic = draftTopic.trim();
    if (!nextTopic) {
      toast.error("Problem / topic cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updatePresentationJob(jobId, {
        topic: nextTopic,
        presenters: draftPresenters.trim() || null,
        studentIds: draftStudentIds.trim() || null,
      });
      toast.success("Job updated");
      setEditOpen(false);
      onUpdated();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePresentationJob(jobId);
      toast.success("Record deleted");
      router.push("/presentation-grading");
    } catch (error) {
      toast.error((error as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={editOpen} onOpenChange={openEdit}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-topic">Question Bank problem / topic</Label>
              <Input
                id="edit-topic"
                maxLength={200}
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-presenters">Presenter names</Label>
              <Input
                id="edit-presenters"
                maxLength={200}
                value={draftPresenters}
                onChange={(e) => setDraftPresenters(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-student-ids">Student IDs</Label>
              <Input
                id="edit-student-ids"
                maxLength={200}
                placeholder="comma-separated"
                value={draftStudentIds}
                onChange={(e) => setDraftStudentIds(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this grading record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the database record — transcript, scores, and analysis
              included. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
