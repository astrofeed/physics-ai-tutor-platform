/**
 * Shared assignment types used across frontend pages and components.
 *
 * These represent the shapes returned by the API (serialized JSON),
 * NOT raw Prisma model types (which use Decimal, Date, etc.).
 */

/** How a numeric answer's distance from the answer key is measured. */
export type ToleranceUnit = "ABSOLUTE" | "PERCENT";

/** Question payload sent to the assignment create/update APIs. */
export interface QuestionPayload {
  id?: string;
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: string;
  points: number;
  diagram?: unknown;
  imageUrl?: string;
  tolerance: number | null;
  toleranceUnit: ToleranceUnit;
}

/** A single question on an assignment, as returned by the API. */
export interface AssignmentQuestion {
  id: string;
  questionText: string;
  questionType: "MC" | "NUMERIC" | "FREE_RESPONSE";
  options: string[] | null;
  correctAnswer: string | null;
  points: number;
  order: number;
  tolerance?: number | null;
  toleranceUnit?: ToleranceUnit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagram?: { type: "svg" | "mermaid"; content: string } | any;
  imageUrl?: string | null;
}

/** Assignment as shown in the list view (assignments page). */
export interface AssignmentListItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  type: "QUIZ" | "FILE_UPLOAD";
  totalPoints: number;
  published: boolean;
  scheduledPublishAt: string | null;
  notifyOnPublish: boolean;
  createdAt: string;
  createdBy: { name: string | null };
  _count: { submissions: number; questions: number };
  lockAfterSubmit: boolean;
  /** Student-specific fields (populated when role is STUDENT) */
  myScore: number | null;
  mySubmitted: boolean;
  myGraded: boolean;
  myProgress?: { answeredCount: number; totalQuestions: number; status: string };
  /** Staff-specific fields */
  ungradedCount?: number;
  openAppealCount?: number;
}

/** Full assignment detail as returned by GET /api/assignments/[id]. */
export interface AssignmentDetail {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  type: "QUIZ" | "FILE_UPLOAD";
  totalPoints: number;
  published: boolean;
  lockAfterSubmit: boolean;
  pdfUrl: string | null;
  scheduledPublishAt: string | null;
  notifyOnPublish: boolean;
  createdBy: { name: string | null };
  publishedBy?: { name: string | null } | null;
  questions: AssignmentQuestion[];
  _count: { submissions: number };
}
