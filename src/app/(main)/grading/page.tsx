"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Trash2 } from "lucide-react";
import { StaffOnly } from "@/components/auth/StaffOnly";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AssignmentPicker } from "@/components/grading/AssignmentPicker";
import { GradingDialogs } from "@/components/grading/GradingDialogs";
import { GradingPanel } from "@/components/grading/GradingPanel";
import { GradingPanelHeader } from "@/components/grading/GradingPanelHeader";
import { GradingPanelStatus } from "@/components/grading/GradingPanelStatus";
import { OverallGradeForm } from "@/components/grading/OverallGradeForm";
import { SubmissionList } from "@/components/grading/SubmissionList";
import { SubmissionToolbar } from "@/components/grading/SubmissionToolbar";
import type {
  Appeal,
  FilterMode,
  SubmissionForGrading,
} from "@/components/grading/types";
import { useGradingAppeals } from "@/hooks/useGradingAppeals";
import { useGradingQueue } from "@/hooks/useGradingQueue";
import { useGradingShortcuts } from "@/hooks/useGradingShortcuts";
import { useSubmissionGrading } from "@/hooks/useSubmissionGrading";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useTrackTime } from "@/lib/use-track-time";
import { fileNameFromUrl } from "@/lib/upload-constraints";

function GradingPageContent() {
  useTrackTime("GRADING");
  const searchParams = useSearchParams();
  const queue = useGradingQueue(searchParams.get("assignmentId"));
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { upload: uploadAnswerImage, uploading: uploadingImage } = useUploadFile();

  const visibleSubmissions = queue.submissions.filter((s) => {
    if (filterMode === "ungraded") return s.totalScore === null;
    if (filterMode === "graded") return s.totalScore !== null;
    if (filterMode === "appeals") return s.openAppealCount > 0;
    return true;
  });

  const patchSubmission = useCallback(
    (submissionId: string, patch: Partial<SubmissionForGrading>) =>
      queue.setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, ...patch } : s))
      ),
    [queue]
  );

  const grading = useSubmissionGrading({
    assignmentInfo: queue.assignmentInfo,
    visibleSubmissions,
    patchSubmission,
    onQueueChanged: queue.refreshCounters,
  });
  const { submission, clearSelection, patchOpenSubmission } = grading;

  const applyAppealUpdate = useCallback(
    (appealId: string, updated: Appeal) => {
      const withAppeal = (sub: SubmissionForGrading) => ({
        ...sub,
        answers: sub.answers.map((a) => ({
          ...a,
          appeals: a.appeals.map((ap) => (ap.id === appealId ? updated : ap)),
        })),
      });
      queue.setSubmissions((prev) =>
        prev.map((sub) => {
          const next = withAppeal(sub);
          return {
            ...next,
            openAppealCount: next.answers.reduce(
              (count, a) => count + a.appeals.filter((ap) => ap.status === "OPEN").length,
              0
            ),
          };
        })
      );
      patchOpenSubmission(withAppeal);
    },
    [queue, patchOpenSubmission]
  );

  /**
   * A re-grade or an appeal decision changes scores on the server, so the grades
   * hydrated into the open submission are stale and finalizing would write them
   * back over the new ones. Close it and reload from the server instead.
   */
  const reloadAfterScoreChange = useCallback(() => {
    clearSelection();
    queue.reloadSubmissions();
  }, [clearSelection, queue]);

  const appeals = useGradingAppeals({
    onAppealUpdated: applyAppealUpdate,
    onScoreChanged: reloadAfterScoreChange,
    onDecided: queue.refreshCounters,
  });

  // Picking another assignment invalidates the open submission.
  useEffect(() => {
    clearSelection();
  }, [queue.selectedAssignmentId, clearSelection]);

  useGradingShortcuts({
    enabled: !!submission && !grading.saving,
    onSaveAndNext: () => {
      if (submission?.gradedAt) return;
      grading.finalize(true);
    },
    onNextSubmission: () => grading.selectAdjacent(1),
    onPrevSubmission: () => grading.selectAdjacent(-1),
    onToggleHelp: () => setShowShortcuts((prev) => !prev),
  });

  const gradedCount = queue.submissions.filter((s) => s.totalScore !== null).length;
  const ungradedCount = queue.submissions.length - gradedCount;
  const appealsCount = queue.submissions.filter((s) => s.openAppealCount > 0).length;
  const manualAnswerCount = grading.manualAnswers.length;
  const finalizeDisabled =
    grading.saving ||
    grading.allAutoGraded ||
    (manualAnswerCount === 0 && !grading.overallGrade.confirmed);

  if (queue.loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Grading
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Review and grade student submissions
        </p>
      </div>

      <div className="space-y-3">
        <AssignmentPicker
          assignments={queue.assignments}
          selectedAssignmentId={queue.selectedAssignmentId}
          onSelect={queue.setSelectedAssignmentId}
          page={queue.page}
          totalPages={queue.totalPages}
          onPageChange={queue.setPage}
        />

        {queue.selectedAssignmentId && (
          <SubmissionToolbar
            assignmentId={queue.selectedAssignmentId}
            assignmentInfo={queue.assignmentInfo}
            submissionCount={queue.submissions.length}
            gradedCount={gradedCount}
            ungradedCount={ungradedCount}
            appealsCount={appealsCount}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            onRegraded={reloadAfterScoreChange}
          />
        )}
      </div>

      {!queue.selectedAssignmentId ? (
        <EmptyState
          icon={ClipboardList}
          title="Select an assignment to grade"
          description="Choose an assignment from the dropdown above."
        />
      ) : queue.loadingSubmissions ? (
        <LoadingSpinner />
      ) : queue.unavailableReason ? (
        <EmptyState
          icon={Trash2}
          title="This assignment is not available for grading"
          description={queue.unavailableReason}
        />
      ) : (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:h-[calc(100vh-16rem)]">
          <SubmissionList
            submissions={visibleSubmissions}
            selectedSubmission={submission}
            onSelectSubmission={grading.select}
            assignmentInfo={queue.assignmentInfo}
            filterMode={filterMode}
          />

          <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            {submission ? (
              <>
                <GradingPanelHeader
                  submission={submission}
                  assignmentInfo={queue.assignmentInfo}
                  allAutoGraded={grading.allAutoGraded}
                  confirmedCount={grading.confirmedAnswers.size}
                  manualAnswerCount={manualAnswerCount}
                  gradingMode={grading.gradingMode}
                  onGradingModeChange={grading.setGradingMode}
                  autoSaveStatus={grading.autoSaveStatus}
                  autoSavedAt={grading.autoSavedAt}
                  showShortcuts={showShortcuts}
                  onShowShortcutsChange={setShowShortcuts}
                  saving={grading.saving}
                  finalizeDisabled={finalizeDisabled}
                  onFinalize={grading.finalize}
                  onUnfinalize={() => grading.setShowUnfinalizeConfirm(true)}
                />

                <div className="flex-1 overflow-auto p-6 space-y-5">
                  <GradingPanelStatus
                    submission={submission}
                    assignmentInfo={queue.assignmentInfo}
                    allAutoGraded={grading.allAutoGraded}
                    showProgress={
                      grading.answerCount > 0 &&
                      !grading.allAutoGraded &&
                      grading.gradingMode === "per-question"
                    }
                    confirmedCount={grading.confirmedAnswers.size}
                    manualAnswerCount={manualAnswerCount}
                    draftRestored={grading.draftRestored}
                    onDismissDraftBanner={grading.dismissDraftBanner}
                  />

                  {grading.gradingMode === "per-question" && (
                    <GradingPanel
                      answers={submission.answers}
                      grades={grading.grades}
                      onGradeChange={grading.changeGrade}
                      confirmedAnswers={grading.confirmedAnswers}
                      onToggleConfirm={grading.toggleConfirmed}
                      aiLoading={grading.aiLoading}
                      onAIGrade={grading.requestAiSuggestion}
                      suggestions={grading.suggestions}
                      onApplySuggestion={grading.applySuggestion}
                      feedbackImages={grading.feedbackImages}
                      onFeedbackImagesChange={grading.setFeedbackImagesFor}
                      onUploadImage={uploadAnswerImage}
                      uploadingImage={uploadingImage}
                      appealMessages={appeals.messages}
                      onAppealMessageChange={appeals.setMessage}
                      appealImages={appeals.images}
                      onAppealImagesChange={appeals.setImages}
                      appealNewScores={appeals.newScores}
                      onAppealNewScoreChange={appeals.setNewScore}
                      expandedAppeals={appeals.expanded}
                      onToggleAppealExpand={appeals.toggleExpanded}
                      resolvingAppeal={appeals.resolving}
                      onResolveAppeal={appeals.requestDecision}
                      onSendAppealMessage={appeals.sendMessage}
                    />
                  )}

                  {!grading.allAutoGraded && (
                    <OverallGradeForm
                      totalPoints={queue.assignmentInfo?.totalPoints || 100}
                      overallScore={grading.overallGrade.score}
                      onOverallScoreChange={grading.setOverallScore}
                      perQuestionTotal={grading.perQuestionTotal}
                      overallFeedback={grading.overallGrade.feedback}
                      onOverallFeedbackChange={grading.setOverallFeedback}
                      overallGradeConfirmed={grading.overallGrade.confirmed}
                      onToggleOverallConfirm={grading.toggleOverallConfirm}
                      feedbackFileUrl={grading.feedbackFile.url}
                      feedbackFileName={
                        grading.feedbackFile.file?.name ??
                        fileNameFromUrl(grading.feedbackFile.url)
                      }
                      uploadingFeedback={grading.uploadingFeedback}
                      onUploadFeedbackFile={grading.attachFeedbackFile}
                      onClearFeedbackFile={grading.clearFeedbackFile}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <ClipboardList className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  Select a submission to start grading
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Choose a student from the left panel
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <GradingDialogs
        finalizeOpen={grading.showFinalizeConfirm}
        onFinalizeOpenChange={grading.setShowFinalizeConfirm}
        confirmedCount={grading.confirmedAnswers.size}
        manualAnswerCount={manualAnswerCount}
        onConfirmFinalize={() => {
          grading.setShowFinalizeConfirm(false);
          grading.releaseGrade();
        }}
        overrideOpen={grading.showOverrideConfirm}
        onOverrideOpenChange={grading.setShowOverrideConfirm}
        perQuestionTotal={grading.perQuestionTotal}
        overrideScore={grading.overallGrade.score}
        totalPoints={queue.assignmentInfo?.totalPoints ?? 0}
        onConfirmOverride={grading.confirmOverride}
        appealStatus={appeals.pendingAction?.status ?? null}
        onAppealOpenChange={(open) => {
          if (!open) appeals.cancelDecision();
        }}
        onConfirmAppeal={appeals.executePendingAction}
        unfinalizeOpen={grading.showUnfinalizeConfirm}
        onUnfinalizeOpenChange={grading.setShowUnfinalizeConfirm}
        onConfirmUnfinalize={grading.unfinalize}
      />
    </div>
  );
}

export default function GradingPage() {
  return (
    <StaffOnly>
      <GradingPageContent />
    </StaffOnly>
  );
}
