export interface AppealMessage {
  id: string;
  content: string;
  imageUrls?: string[];
  createdAt: string;
  user: { id: string; name: string | null; role: string };
}

export interface Appeal {
  id: string;
  status: string;
  reason: string;
  imageUrls?: string[];
  createdAt: string;
  student: { id: string; name: string | null };
  messages: AppealMessage[];
}

/** An assignment as listed in the grading page's picker. */
export interface AssignmentOption {
  id: string;
  title: string;
  type: string;
  totalPoints: number;
  submissionCount: number;
  ungradedCount: number;
  gradedCount: number;
  openAppealCount: number;
}

export interface AssignmentInfo {
  title: string;
  type: string;
  totalPoints: number;
  dueDate: string | null;
}

export interface SubmissionAnswer {
  id: string;
  questionText: string;
  questionType: string;
  answer: string | null;
  answerImageUrls?: string[];
  feedbackImageUrls?: string[];
  score: number | null;
  feedback: string | null;
  autoGraded: boolean;
  /** The question's stored answer key, shown to graders only. */
  referenceAnswer: string | null;
  /** Extra answers that also score full marks, shown to graders only. */
  alsoAcceptedAnswers?: string[];
  /** AI pre-grade recommendation; never an official score until a grader applies it. */
  aiSuggestedScore: number | null;
  aiSuggestedFeedback: string | null;
  aiSuggestedAt: string | null;
  maxPoints: number;
  leftBlank?: boolean;
  appeals: Appeal[];
}

export interface SubmissionForGrading {
  id: string;
  userName: string;
  userEmail: string;
  submittedAt: string;
  totalScore: number | null;
  gradedAt: string | null;
  gradedByName: string | null;
  /** The student's own upload; a grader's attachment lives in `feedbackFileUrl`. */
  fileUrl: string | null;
  feedbackFileUrl: string | null;
  overallFeedback: string | null;
  openAppealCount: number;
  totalAppealCount: number;
  answers: SubmissionAnswer[];
}

export interface OverallGradeState {
  /** `null` means "no override" — the per-question total is released instead. */
  score: number | null;
  feedback: string;
  confirmed: boolean;
}

export type GradingMode = "per-question" | "overall";
export type FilterMode = "all" | "ungraded" | "graded" | "appeals";
