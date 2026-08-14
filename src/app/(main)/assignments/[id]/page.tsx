"use client";

import React from "react";
import {
  Loader2,
  Send,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isStaff as isStaffRole } from "@/lib/constants";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import Link from "next/link";

import { QuestionRenderer } from "@/components/assignments/QuestionRenderer";
import { SubmissionView } from "@/components/assignments/SubmissionView";
import { FileUploadSection } from "@/components/assignments/FileUploadSection";
import { AssignmentHeader } from "./components/AssignmentHeader";
import { PublishDialogs } from "./components/PublishDialogs";
import { StaffAppealsSection } from "./components/StaffAppealsSection";
import { useAssignmentDetail } from "@/hooks/useAssignmentDetail";
import { SideChatLayout } from "@/components/chat/SideChatLayout";

export default function AssignmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const s = useAssignmentDetail(params.id);

  if (s.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!s.assignment) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500">Assignment not found.</p>
      </div>
    );
  }

  if (s.submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Submitted!</h2>
        <p className="text-neutral-500 mb-6">Your submission has been recorded successfully.</p>
        <Link href="/assignments">
          <Button>Back to Assignments</Button>
        </Link>
      </div>
    );
  }

  const { assignment } = s;
  const isStudentDraft = (!s.existingSubmission || s.existingSubmission.isDraft) && s.userRole === "STUDENT";

  return (
    <SideChatLayout contextLabel={assignment.title}>
      <div className="max-w-4xl mx-auto space-y-6">
        <AssignmentHeader
          assignment={assignment}
          userRole={s.userRole}
          onPublish={s.handlePublish}
          onSchedule={s.handleSchedule}
          onCancelSchedule={() => s.setCancelScheduleDialogOpen(true)}
          onToggleLock={s.handleToggleLock}
          onDelete={s.handleDelete}
          onExportLatex={s.handleExportLatex}
          exportingLatex={s.exportingLatex}
          deleting={s.deleting}
        />

        {/* Quiz questions (student answering) */}
        {assignment.type === "QUIZ" && isStudentDraft && (
          <div className="space-y-4">
            {(() => {
              const total = assignment.questions.length;
              const answered = assignment.questions.filter(q =>
                (s.answers[q.id]?.trim()) || (s.answerImages[q.id]?.length > 0)
              ).length;
              return (
                <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Progress: {answered}/{total} questions answered
                      </span>
                      {answered === total && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">All done!</span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${answered === total ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
            {assignment.questions.map((q, index) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                index={index}
                answer={s.answers[q.id] || ""}
                onAnswerChange={s.handleAnswerChange}
                answerImages={s.answerImages[q.id] || []}
                onAnswerImagesChange={s.handleAnswerImagesChange}
                onUploadImage={s.handleUploadImage}
                uploadingImage={s.uploadingImage}
              />
            ))}
          </div>
        )}

        {assignment.type === "QUIZ" && isStudentDraft && (
          <FileUploadSection variant="attachment" file={s.attachmentFile} onFileChange={s.setAttachmentFile} />
        )}

        {s.draftRestored && isStudentDraft && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">Your previous answers were restored from an auto-saved draft.</p>
            <button onClick={() => s.setDraftRestored(false)} className="ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">
              <span className="sr-only">Dismiss</span>&times;
            </button>
          </div>
        )}

        {s.existingSubmission && !s.existingSubmission.isDraft && !s.submitted && (
          <SubmissionView
            submission={s.existingSubmission}
            assignment={{ totalPoints: assignment.totalPoints, lockAfterSubmit: assignment.lockAfterSubmit, dueDate: assignment.dueDate, questions: assignment.questions }}
            userRole={s.userRole}
            getAppealForAnswer={s.getAppealForAnswer}
            expandedAppeals={s.expandedAppeals}
            onToggleAppealExpand={(key) => s.setExpandedAppeals((prev) => ({ ...prev, [key]: !prev[key] }))}
            appealReasons={s.appealReasons}
            onAppealReasonChange={(id, v) => s.setAppealReasons((prev) => ({ ...prev, [id]: v }))}
            appealMessages={s.appealMessages}
            onAppealMessageChange={(id, v) => s.setAppealMessages((prev) => ({ ...prev, [id]: v }))}
            appealImages={s.appealImages}
            onAppealImagesChange={(key, imgs) => s.setAppealImages((prev) => ({ ...prev, [key]: imgs }))}
            appealNewScores={s.appealNewScores}
            onAppealNewScoreChange={(id, v) => s.setAppealNewScores((prev) => ({ ...prev, [id]: v }))}
            onUploadImage={s.handleUploadImage}
            uploadingImage={s.uploadingImage}
            submittingAppeal={s.submittingAppeal}
            onSubmitAppeal={s.handleSubmitAppeal}
            resolvingAppeal={s.resolvingAppeal}
            onResolveAppeal={s.handleResolveAppeal}
            onSendAppealMessage={s.handleAppealMessage}
            onEditSubmission={s.handleEditSubmission}
            deletingSubmission={s.deletingSubmission}
          />
        )}

        {assignment.type === "FILE_UPLOAD" && isStudentDraft && (
          <FileUploadSection
            variant="main"
            file={s.file}
            onFileChange={s.setFile}
            currentFileUrl={s.existingSubmission?.fileUrl ?? null}
          />
        )}

        {isStudentDraft && (
          <div className="space-y-3 pb-8">
            {assignment.lockAfterSubmit && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This assignment is locked after submission. You will <strong>not</strong> be able to change or resubmit your answers.
                </p>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              {assignment.type === "QUIZ" && (() => {
                const total = assignment.questions.length;
                const answered = assignment.questions.filter(q =>
                  (s.answers[q.id]?.trim()) || (s.answerImages[q.id]?.length > 0)
                ).length;
                return (
                  <span className={`text-xs font-medium ${answered === total ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {answered}/{total} answered
                  </span>
                );
              })()}
              <SaveStatusIndicator status={s.autoSaveStatus} lastSavedAt={s.lastSavedAt} />
              <Button onClick={s.handleSubmit} disabled={s.submitting} className="gap-2">
                {s.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          </div>
        )}

        {isStaffRole(s.userRole) && s.appeals.length > 0 && (
          <StaffAppealsSection
            appeals={s.appeals}
            questions={assignment.questions}
            appealFilter={s.appealFilter}
            setAppealFilter={s.setAppealFilter}
            expandedAppeals={s.expandedAppeals}
            onToggleExpand={(id) => s.setExpandedAppeals((prev) => ({ ...prev, [id]: !prev[id] }))}
            appealMessages={s.appealMessages}
            onAppealMessageChange={(id, v) => s.setAppealMessages((prev) => ({ ...prev, [id]: v }))}
            appealNewScores={s.appealNewScores}
            onAppealNewScoreChange={(id, v) => s.setAppealNewScores((prev) => ({ ...prev, [id]: v }))}
            appealImages={s.appealImages}
            onAppealImagesChange={(key, imgs) => s.setAppealImages((prev) => ({ ...prev, [key]: imgs }))}
            onUploadImage={s.handleUploadImage}
            uploadingImage={s.uploadingImage}
            resolvingAppeal={s.resolvingAppeal}
            onResolveAppeal={s.handleResolveAppeal}
            onSendAppealMessage={s.handleAppealMessage}
          />
        )}

        <PublishDialogs
          assignment={assignment}
          setAssignment={s.setAssignment}
          unpublishDialogOpen={s.unpublishDialogOpen}
          setUnpublishDialogOpen={s.setUnpublishDialogOpen}
          notifyDialogOpen={s.notifyDialogOpen}
          setNotifyDialogOpen={s.setNotifyDialogOpen}
          scheduleDialogOpen={s.scheduleDialogOpen}
          setScheduleDialogOpen={s.setScheduleDialogOpen}
          cancelScheduleDialogOpen={s.cancelScheduleDialogOpen}
          setCancelScheduleDialogOpen={s.setCancelScheduleDialogOpen}
          notifySubject={s.notifySubject}
          notifyMessage={s.notifyMessage}
        />

        <AlertDialog open={s.confirmDialog.open} onOpenChange={(open) => { if (!open) s.setConfirmDialog((prev) => ({ ...prev, open: false })); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{s.confirmDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>{s.confirmDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { s.setConfirmDialog((prev) => ({ ...prev, open: false })); s.confirmDialog.onConfirm(); }}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SideChatLayout>
  );
}
