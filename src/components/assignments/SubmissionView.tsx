"use client";

import React from "react";
import {
  Clock,
  Loader2,
  Send,
  CheckCircle,
  Download,
  Pencil,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_APPEAL_MESSAGE_LENGTH,
  MAX_APPEAL_REASON_LENGTH,
} from "@/hooks/useAssignmentAppeals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttachmentThumbnails } from "@/components/ui/attachment-thumbnails";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatShortDate } from "@/lib/utils";
import { isStaff } from "@/lib/constants";
import type { AssignmentQuestion } from "@/types/assignment";
import type { ExistingSubmission, GradeAppealData } from "@/types/submission";

interface SubmissionViewProps {
  submission: ExistingSubmission;
  assignment: {
    totalPoints: number;
    lockAfterSubmit: boolean;
    dueDate: string | null;
    questions: AssignmentQuestion[];
  };
  userRole: string;
  /** Appeal state and callbacks */
  getAppealForAnswer: (answerId: string) => GradeAppealData | undefined;
  expandedAppeals: Record<string, boolean>;
  onToggleAppealExpand: (key: string) => void;
  appealReasons: Record<string, string>;
  onAppealReasonChange: (answerId: string, value: string) => void;
  appealMessages: Record<string, string>;
  onAppealMessageChange: (appealId: string, value: string) => void;
  appealImages: Record<string, string[]>;
  onAppealImagesChange: (key: string, images: string[]) => void;
  appealNewScores: Record<string, string>;
  onAppealNewScoreChange: (appealId: string, value: string) => void;
  onUploadImage: (file: File) => Promise<string | null>;
  uploadingImage: boolean;
  submittingAppeal: string | null;
  onSubmitAppeal: (answerId: string) => void;
  resolvingAppeal: string | null;
  onResolveAppeal: (
    appealId: string,
    status: "RESOLVED" | "REJECTED" | "OPEN"
  ) => void;
  onSendAppealMessage: (appealId: string) => void;
  /** Edit/resubmit */
  onEditSubmission: () => void;
  deletingSubmission: boolean;
}

export function SubmissionView({
  submission,
  assignment,
  userRole,
  getAppealForAnswer,
  expandedAppeals,
  onToggleAppealExpand,
  appealReasons,
  onAppealReasonChange,
  appealMessages,
  onAppealMessageChange,
  appealImages,
  onAppealImagesChange,
  appealNewScores,
  onAppealNewScoreChange,
  onUploadImage,
  uploadingImage,
  submittingAppeal,
  onSubmitAppeal,
  resolvingAppeal,
  onResolveAppeal,
  onSendAppealMessage,
  onEditSubmission,
  deletingSubmission,
}: SubmissionViewProps) {
  const isLate = submission.isLate ?? false;

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="h-5 w-5" />
          Submission Recorded
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Submitted: {formatShortDate(submission.submittedAt)}
          </span>
          {isLate && (
            <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Late Submission
            </Badge>
          )}
          {submission.totalScore !== null ? (
            <Badge variant="secondary">
              Score: {submission.totalScore} / {assignment.totalPoints}
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 gap-1">
              <Clock className="h-3 w-3" />
              Not graded yet
            </Badge>
          )}
        </div>
        {submission.fileUrl && (
          <a
            href={submission.fileUrl}
            download
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Download className="h-4 w-4" />
            Download your submission
          </a>
        )}
        {submission.feedbackFileUrl && (
          <a
            href={submission.feedbackFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Download className="h-4 w-4" />
            Download the grader&apos;s feedback file
          </a>
        )}
        {assignment.lockAfterSubmit ||
        submission.totalScore !== null ||
        submission.answers?.some((a) => a.score !== null) ? (
          <div className="flex items-center gap-2 pt-2 px-3 py-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {assignment.lockAfterSubmit
                ? "This assignment is locked. You cannot edit or resubmit."
                : "This submission has been graded. You cannot edit or resubmit."}
            </p>
          </div>
        ) : (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEditSubmission}
              disabled={deletingSubmission}
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
            >
              {deletingSubmission ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
              Edit & Resubmit
            </Button>
          </div>
        )}

        {/* Overall feedback from grader */}
        {submission.overallFeedback && submission.totalScore !== null && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2 bg-gray-50 dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Grader Feedback
            </p>
            <MarkdownContent
              content={submission.overallFeedback}
              className="text-sm text-gray-600 dark:text-gray-400"
            />
          </div>
        )}

        {/* Per-question feedback with appeal support */}
        {submission.answers &&
          submission.answers.length > 0 &&
          submission.totalScore !== null && (
            <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Grading Details
              </p>
              {submission.answers.map((ans, idx) => {
                const question = assignment.questions.find(
                  (q) => q.id === ans.questionId
                );
                const appeal = getAppealForAnswer(ans.id);
                return (
                  <div
                    key={ans.id}
                    className="rounded-lg border border-gray-100 dark:border-gray-800 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Question {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {appeal && (
                          <Badge
                            className={`text-xs gap-1 ${
                              appeal.status === "OPEN"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
                                : appeal.status === "RESOLVED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                            }`}
                          >
                            {appeal.status === "OPEN" ? (
                              <>
                                <ShieldAlert className="h-3 w-3" /> Appeal
                                Pending
                              </>
                            ) : appeal.status === "RESOLVED" ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Appeal
                                Accepted
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" /> Appeal Denied
                              </>
                            )}
                          </Badge>
                        )}
                        <span
                          className={`text-sm font-semibold ${
                            ans.score !== null && question
                              ? ans.score >= question.points
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-gray-700 dark:text-gray-300"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {ans.score !== null
                            ? `${ans.score}/${question?.points ?? "?"}`
                            : "Not graded"}
                        </span>
                      </div>
                    </div>
                    {ans.answer && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Your answer: {ans.answer}
                      </p>
                    )}
                    <AttachmentThumbnails
                      urls={ans.answerImageUrls ?? []}
                      label="Your attachment"
                      size="sm"
                    />
                    {ans.feedback && (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 overflow-hidden">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                          Feedback
                        </p>
                        <MarkdownContent
                          content={ans.feedback}
                          className="text-sm text-blue-800 dark:text-blue-300"
                        />
                        {ans.feedbackImageUrls &&
                          ans.feedbackImageUrls.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {ans.feedbackImageUrls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Feedback image ${i + 1}`}
                                    className="h-20 w-20 object-cover rounded-lg border border-blue-200 dark:border-blue-700 hover:opacity-80 transition-opacity"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Appeal section - submit new appeal (student only) */}
                    {ans.score !== null &&
                      !appeal &&
                      userRole === "STUDENT" && (
                        <div className="pt-2 space-y-2">
                          <button
                            onClick={() =>
                              onToggleAppealExpand(`new-${ans.id}`)
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Appeal this grade
                          </button>
                          {expandedAppeals[`new-${ans.id}`] && (
                            <div className="space-y-2 pl-5">
                              <Textarea
                                value={appealReasons[ans.id] || ""}
                                onChange={(e) =>
                                  onAppealReasonChange(
                                    ans.id,
                                    e.target.value
                                  )
                                }
                                placeholder="Explain why you believe this grade should be reconsidered..."
                                rows={3}
                                maxLength={MAX_APPEAL_REASON_LENGTH}
                                className="text-sm"
                              />
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 text-right">
                                {(appealReasons[ans.id] || "").length} / {MAX_APPEAL_REASON_LENGTH}
                              </p>
                              <ImageUpload
                                images={appealImages[ans.id] || []}
                                onImagesChange={(imgs) =>
                                  onAppealImagesChange(ans.id, imgs)
                                }
                                onUpload={onUploadImage}
                                uploading={uploadingImage}
                                maxImages={3}
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => onSubmitAppeal(ans.id)}
                                  disabled={
                                    submittingAppeal === ans.id ||
                                    !appealReasons[ans.id]?.trim()
                                  }
                                  className="gap-1.5"
                                >
                                  {submittingAppeal === ans.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  Submit Appeal
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Existing appeal thread */}
                    {appeal && (
                      <AppealThreadInline
                        appeal={appeal}
                        question={question}
                        userRole={userRole}
                        isExpanded={expandedAppeals[appeal.id] || false}
                        onToggle={() => onToggleAppealExpand(appeal.id)}
                        message={appealMessages[appeal.id] || ""}
                        onMessageChange={(v) =>
                          onAppealMessageChange(appeal.id, v)
                        }
                        images={appealImages[appeal.id] || []}
                        onImagesChange={(imgs) =>
                          onAppealImagesChange(appeal.id, imgs)
                        }
                        newScore={appealNewScores[appeal.id] || ""}
                        onNewScoreChange={(v) =>
                          onAppealNewScoreChange(appeal.id, v)
                        }
                        onUploadImage={onUploadImage}
                        uploadingImage={uploadingImage}
                        resolving={resolvingAppeal === appeal.id}
                        onResolve={(status) =>
                          onResolveAppeal(appeal.id, status)
                        }
                        onSendMessage={() => onSendAppealMessage(appeal.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

/** Inline appeal thread used within the submission view (student-facing) */
function AppealThreadInline({
  appeal,
  question,
  userRole,
  isExpanded,
  onToggle,
  message,
  onMessageChange,
  images,
  onImagesChange,
  newScore,
  onNewScoreChange,
  onUploadImage,
  uploadingImage,
  resolving,
  onResolve,
  onSendMessage,
}: {
  appeal: GradeAppealData;
  question: AssignmentQuestion | undefined;
  userRole: string;
  isExpanded: boolean;
  onToggle: () => void;
  message: string;
  onMessageChange: (v: string) => void;
  images: string[];
  onImagesChange: (imgs: string[]) => void;
  newScore: string;
  onNewScoreChange: (v: string) => void;
  onUploadImage: (file: File) => Promise<string | null>;
  uploadingImage: boolean;
  resolving: boolean;
  onResolve: (status: "RESOLVED" | "REJECTED" | "OPEN") => void;
  onSendMessage: () => void;
}) {
  const isStaffViewer = isStaff(userRole);

  return (
    <div className="pt-2 space-y-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {isExpanded
          ? "Hide appeal thread"
          : `View appeal thread (${appeal.messages.length + 1} message${appeal.messages.length > 0 ? "s" : ""})`}
      </button>
      {isExpanded && (
        <div className="space-y-3 pl-5 border-l-2 border-amber-200 dark:border-amber-800">
          {/* Original appeal reason */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {appeal.student.name || "Student"}
              </span>
              <span className="text-xs text-amber-500 dark:text-amber-600">
                {formatShortDate(appeal.createdAt)}
              </span>
            </div>
            <MarkdownContent
              content={appeal.reason}
              className="text-sm text-amber-800 dark:text-amber-300"
            />
            {appeal.imageUrls &&
              (appeal.imageUrls as string[]).length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(appeal.imageUrls as string[]).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Attachment ${i + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-amber-200 dark:border-amber-700 hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              )}
          </div>

          {/* Messages thread */}
          {appeal.messages.map((msg) => {
            const isStaff =
              msg.user.role === "TA" ||
              msg.user.role === "ADMIN" ||
              msg.user.role === "PROFESSOR";
            return (
              <div
                key={msg.id}
                className={`rounded-lg p-3 border overflow-hidden ${
                  isStaff
                    ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800"
                    : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      isStaff
                        ? "text-indigo-700 dark:text-indigo-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {msg.user.name || "User"}
                  </span>
                  {isStaff && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-600 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-400 dark:border-indigo-700">
                      {msg.user.role}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatShortDate(msg.createdAt)}
                  </span>
                </div>
                <MarkdownContent
                  content={msg.content}
                  className="text-sm text-gray-800 dark:text-gray-200"
                />
                {msg.imageUrls &&
                  (msg.imageUrls as string[]).length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(msg.imageUrls as string[]).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Attachment ${i + 1}`}
                            className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}

          {/* Reply box */}
          <div className="space-y-2">
            <Textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder={
                appeal.status === "OPEN"
                  ? "Write a reply..."
                  : "Add a follow-up message..."
              }
              rows={2}
              maxLength={MAX_APPEAL_MESSAGE_LENGTH}
              className="text-sm"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-right">
              {message.length} / {MAX_APPEAL_MESSAGE_LENGTH}
            </p>
            <ImageUpload
              images={images}
              onImagesChange={onImagesChange}
              onUpload={onUploadImage}
              uploading={uploadingImage}
              maxImages={3}
            />

            {/* TA/Admin: resolve/reject/reopen controls */}
            {isStaffViewer && (
              <div className="space-y-2">
                {appeal.status === "OPEN" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max={question?.points ?? 100}
                      value={newScore}
                      onChange={(e) => onNewScoreChange(e.target.value)}
                      placeholder={`New score (max ${question?.points ?? "?"})`}
                      className="w-44 text-sm"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {appeal.status === "OPEN" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onResolve("RESOLVED")}
                        disabled={resolving}
                        className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
                      >
                        {resolving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Accept & Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onResolve("REJECTED")}
                        disabled={resolving}
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                      >
                        {resolving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Deny
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onResolve("OPEN")}
                      disabled={resolving}
                      className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
                    >
                      {resolving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      Reopen
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onSendMessage}
                    disabled={!message?.trim()}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Reply
                  </Button>
                </div>
              </div>
            )}

            {/* Student: Send reply button */}
            {userRole === "STUDENT" && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSendMessage}
                  disabled={!message?.trim()}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Reply
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

