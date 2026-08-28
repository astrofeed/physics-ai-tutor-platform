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
import { deleteReportJob, updateReportJob } from "@/hooks/useReportGrading";

interface ReportJobActionsProps {
  jobId: string;
  title: string;
  authors: string | null;
  onUpdated: () => void;
}

/** Edit (title / author names) and delete controls for one grading job. */
export function ReportJobActions({ jobId, title, authors, onUpdated }: ReportJobActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftAuthors, setDraftAuthors] = useState(authors ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEdit = (open: boolean) => {
    if (open) {
      setDraftTitle(title);
      setDraftAuthors(authors ?? "");
    }
    setEditOpen(open);
  };

  const handleSave = async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      toast.error("Report title cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updateReportJob(jobId, {
        title: nextTitle,
        authors: draftAuthors.trim() || null,
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
      await deleteReportJob(jobId);
      toast.success("Record deleted");
      router.push("/report-grading");
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
              <Label htmlFor="edit-report-title">Report title</Label>
              <Input
                id="edit-report-title"
                maxLength={200}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-report-authors">Author names</Label>
              <Input
                id="edit-report-authors"
                maxLength={200}
                value={draftAuthors}
                onChange={(e) => setDraftAuthors(e.target.value)}
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
              This permanently deletes the database record — report text and review included.
              This cannot be undone.
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
