# AGENTS.md — Physics AI Tutor Platform

### Incremental AGENTS.md

Whenever you make changes to the codebase, update this file to reflect the changes.


## Coding Standards & Rules

All agents modifying this codebase **must** follow these rules. They are derived from a senior engineer audit and exist to prevent recurring anti-patterns. **Violating any of these rules is a blocking issue.**

### ⚠️ Proactive Remediation Mandate

These rules are not just for new code. **When you encounter existing code that violates any rule below, you must fix it** as part of your current task — even if the user did not explicitly ask for it. Treat legacy violations as tech debt that must be paid down on contact.

**How to apply this:**

1. **Boy Scout Rule — leave every file cleaner than you found it.** If you open a file to make a change and notice violations of the rules below, fix them in the same PR. Do not leave known violations in files you touch.

2. **If a file you are editing exceeds ~400 lines** (Rule 1.1), you must split it into subcomponents/hooks before making your change. Do not add more code to an already-oversized file.

3. **If you see `useEffect` + `fetch()` for data loading** (Rule 1.2) in a file you are modifying, refactor it to use a React Query hook. Create the hook in `src/hooks/` if it doesn't exist yet.

4. **If you see an inline type definition** (Rule 1.3) that duplicates one already in `src/types/` or could be shared, replace it with an import from the shared types.

5. **If you see a route handler with >50 lines of business logic** (Rule 1.4), extract the logic into a service function in `src/lib/services/` before making your change.

6. **If you see `path.join()` with user input** (Rule 2.1), immediately fix it to use `path.resolve()` + directory containment check. This is a security vulnerability — fix it before doing anything else.

7. **If you see a cron endpoint that skips auth when `CRON_SECRET` is unset** (Rule 2.2), fix it to fail closed immediately. This is a security vulnerability.

8. **If you see unvalidated numeric input** (scores, points) being saved to the database (Rule 2.3), add bounds checking before your change.

9. **If you see an API route without Zod validation** (Rule 4.1) that you are modifying, add a Zod schema for its input. Don't skip this because "it's not part of the task."

10. **If you see `window.alert()` or `window.confirm()`** (Rule 5.1) in a file you touch, replace with shadcn `AlertDialog` or `sonner` toast.

11. **If you see `.catch(() => {})` (silent error swallowing)** (Rule 7.1) anywhere in a file you are editing, add proper error logging with context.

12. **If you see `prisma db push` or `--accept-data-loss`** anywhere (Rule 3.1), remove it and replace with `prisma migrate deploy`. This is a data safety issue.

13. **If you see a `useState` with `any` return type from `localStorage`** (Rule 6.2), add Zod validation for the deserialized data.

14. **If you see more than 8 `useState` calls in a single component** (Rule 6.1), refactor to `useReducer` before adding more state.

15. **If you see inline HTML email templates** as template literals in TypeScript (Rule 9.2), extract them to separate template files.

**Scope of fixes:** Fix violations in files you are actively modifying. You do not need to scan the entire codebase for violations on every task — but you must fix what you see in your working set. If a fix would be large and disruptive (e.g., splitting a 1,800-line component), note it in a code comment `// TODO: Split into subcomponents per AGENTS.md Rule 1.1` and mention it to the user, but still make the fix if it's feasible within the current task scope.

---

### 1. Architecture

#### 1.1 No God Components (Max ~400 Lines Per File)

No single component or page file may exceed ~400 lines. If you are adding code to a file that is already near this limit, **split first, then add**.

When a page needs multiple concerns (e.g., the grading page needs submission list, grading panel, appeal threads, overall scoring), each concern becomes its own component in a colocated directory:

```
src/app/(main)/grading/
├── page.tsx                    # <200 lines, composes subcomponents
├── components/
│   ├── SubmissionList.tsx      # Submission picker/list
│   ├── GradingPanel.tsx        # Per-question grading UI
│   ├── OverallGradeForm.tsx    # Overall score + feedback
│   └── AppealThread.tsx        # OR shared from src/components/
└── hooks/
    └── useGradingState.ts      # All grading state via useReducer
```

**❌ Bad — everything in one file:**
```tsx
// page.tsx — 1,859 lines
export default function AssignmentPage() {
  const [submissions, setSubmissions] = useState([]);
  const [grades, setGrades] = useState({});
  const [appeals, setAppeals] = useState([]);
  // ... 90 more useState calls, 40 event handlers, 1500 lines of JSX
}
```

**✅ Good — composed from focused components:**
```tsx
// page.tsx — ~150 lines
export default function AssignmentPage() {
  return (
    <GradingStateProvider assignmentId={id}>
      <SubmissionList />
      <GradingPanel />
      <AppealThread />
    </GradingStateProvider>
  );
}
```

#### 1.2 Separate Data from Presentation

Never use raw `useEffect` + `fetch()` for data loading. This pattern was found in **15+ files** and causes: no request deduplication, no caching, no retry logic, no stale-while-revalidate, and a loading spinner on every mount.

Use React Query (TanStack Query) with typed custom hooks in `src/hooks/`:

**❌ Bad — inline fetch in every component:**
```tsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetch("/api/assignments")
    .then(res => res.json())
    .then(data => { setData(data); setLoading(false); })
    .catch(() => setLoading(false));
}, []);
```

**✅ Good — shared typed hook:**
```tsx
// src/hooks/useAssignments.ts
import { useQuery } from "@tanstack/react-query";
import type { Assignment } from "@/types/assignment";

export function useAssignments(filter?: string) {
  return useQuery<Assignment[]>({
    queryKey: ["assignments", filter],
    queryFn: () => fetch(`/api/assignments?filter=${filter}`).then(r => r.json()).then(d => d.data),
  });
}

// In any component:
const { data: assignments, isLoading, error } = useAssignments("published");
```

#### 1.3 Shared Type System

Define all data types in `src/types/` (one file per domain: `assignment.ts`, `submission.ts`, `user.ts`, `grading.ts`). Derive frontend types from the Prisma schema where possible using `Prisma` namespace types.

**❌ Bad — same type redeclared inline in 3 files:**
```tsx
// In grading/page.tsx:
interface SubmissionForGrading { id: string; userId: string; ... }
// In assignments/[id]/page.tsx:
interface Submission { id: string; user: { name: string }; ... }
// In api-auth.ts:
type UserRole = "STUDENT" | "TA" | "PROFESSOR" | "ADMIN";
// Also in types/index.ts:
export type UserRole = "STUDENT" | "TA" | "PROFESSOR" | "ADMIN";
```

**✅ Good — single source of truth:**
```tsx
// src/types/user.ts
import { Role } from "@prisma/client";
export type UserRole = Role; // derives from Prisma enum
export interface SessionUser { id: string; name: string; email: string; role: UserRole; }

// src/types/submission.ts
export interface Submission { id: string; userId: string; assignmentId: string; ... }
export interface SubmissionForGrading extends Submission { answers: SubmissionAnswer[]; ... }
```

#### 1.4 Service Layer for Business Logic

API route handlers (`src/app/api/*/route.ts`) must **not** contain business logic directly. Route handlers should only: (1) parse/validate input, (2) call a service function, (3) return the response.

Extract logic into `src/lib/services/` (e.g., `grading-service.ts`, `assignment-service.ts`). This allows the same logic to be called from API routes, cron jobs, webhooks, CLI tools, or tests.

**❌ Bad — 300-line route handler with inline logic:**
```ts
// api/grading/route.ts
export async function POST(req: Request) {
  const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
  // ... 250 lines of grading logic, score calculation, email sending, audit logging
}
```

**✅ Good — thin route handler + service:**
```ts
// api/grading/route.ts
export async function POST(req: Request) {
  const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
  if (isErrorResponse(auth)) return auth;
  const body = GradingInputSchema.parse(await req.json());
  const result = await gradingService.submitGrades(auth.user, body);
  return NextResponse.json({ data: result });
}

// src/lib/services/grading-service.ts
export async function submitGrades(user: ApiUser, input: GradingInput) {
  // all business logic here — testable, reusable
}
```

---

### 2. Security

#### 2.1 Path Traversal Prevention

When constructing file paths from user input (e.g., `imageUrl`, file names), **always** use `path.resolve()` and verify the resolved path stays within the expected directory. `path.join()` does NOT sanitize `../` sequences.

**❌ Bad — allows reading `/etc/passwd` via `../../etc/passwd`:**
```ts
const imgPath = path.join(process.cwd(), "public", userSuppliedPath.replace(/^\//, ""));
const data = fs.readFileSync(imgPath); // DANGER
```

**✅ Good — validates resolved path:**
```ts
const publicDir = path.resolve(process.cwd(), "public");
const resolved = path.resolve(publicDir, userSuppliedPath.replace(/^\//, ""));
if (!resolved.startsWith(publicDir + path.sep)) {
  throw new Error("Invalid file path: directory traversal detected");
}
const data = fs.readFileSync(resolved);
```

#### 2.2 Mandatory Cron Auth (Fail Closed)

All cron endpoints under `src/app/api/cron/` must **require** `CRON_SECRET`. If the env var is not set, the endpoint must return 500, **not** skip authentication. An unauthenticated cron endpoint can be called by anyone on the internet.

**❌ Bad — skips auth if env var missing:**
```ts
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) {
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
// If CRON_SECRET not set, anyone can call this endpoint
```

**✅ Good — fails closed:**
```ts
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  console.error("[cron] CRON_SECRET is not configured");
  return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
}
if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

#### 2.3 Validate All Numeric Inputs

Scores, points, and any numeric field from client input must be bounds-checked before saving. Never trust raw client values.

**❌ Bad — accepts any number:**
```ts
await prisma.submissionAnswer.update({
  where: { id: answerId },
  data: { score: grade.score }, // Could be -1000 or 999999 or NaN
});
```

**✅ Good — validated against question bounds:**
```ts
const score = Number(grade.score);
if (!Number.isFinite(score) || score < 0 || score > question.points) {
  return NextResponse.json({ error: `Score must be between 0 and ${question.points}` }, { status: 400 });
}
```

#### 2.4 Input Size Limits on All Endpoints

Every API route accepting text input must enforce maximum lengths via Zod `.max()`. Without limits, a malicious user can send a 100MB JSON body.

| Field type | Max length |
|---|---|
| `subject` (email/notification) | 500 chars |
| `message` / `feedback` | 10,000 chars |
| `reason` (appeals) | 5,000 chars |
| `name` / `title` | 200 chars |
| `description` | 5,000 chars |
| Chat messages | 50,000 chars (already enforced) |

```ts
const AppealInputSchema = z.object({
  reason: z.string().min(1).max(5000),
  score: z.number().min(0),
});
```

#### 2.5 Role Hierarchy Enforcement

When one user acts on another (delete, role change, ban), the acting user must outrank the target. Use a shared role hierarchy utility from `src/lib/constants.ts`.

**Role hierarchy (highest to lowest):** `ADMIN > PROFESSOR > TA > STUDENT`

```ts
// src/lib/constants.ts
export const ROLE_RANK: Record<UserRole, number> = {
  STUDENT: 0, TA: 1, PROFESSOR: 2, ADMIN: 3,
};
export function outranks(actor: UserRole, target: UserRole): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
```

**❌ Bad — TA can delete a Professor:**
```ts
if (auth.user.role === "TA" || auth.user.role === "PROFESSOR" || auth.user.role === "ADMIN") {
  await prisma.user.delete({ where: { id: targetUserId } });
}
```

**✅ Good — checks rank:**
```ts
if (!outranks(auth.user.role, targetUser.role)) {
  return NextResponse.json({ error: "Cannot modify a user with equal or higher role" }, { status: 403 });
}
```

#### 2.6 E2E Test Mode Safety

`E2E_TEST_MODE` bypasses all authentication. It must **only** work when `NODE_ENV !== "production"`. This guard exists in `src/middleware.ts` and `src/lib/impersonate.ts`. Never weaken it. Never add additional bypass paths.

#### 2.7 Middleware Must Cover API Routes

The Next.js middleware matcher in `src/middleware.ts` must include `/api/:path*` (except `/api/auth`). Without this, any new API route added without an explicit `requireApiAuth()` call is silently unprotected. Each API route must still call `requireApiAuth()` or `requireApiRole()` as defense in depth — middleware is the first line, route-level auth is the second.

---

### 3. Database & Schema

#### 3.1 Use Prisma Migrations, Never `db push`

The build/deploy script must use `prisma migrate deploy` for applying schema changes. **Never** use `prisma db push`, especially with `--accept-data-loss`, in any script, CI pipeline, or production build. The `--accept-data-loss` flag can silently drop columns or tables.

**❌ Bad — in `package.json` build script:**
```json
"build": "prisma generate && prisma db push --accept-data-loss && next build"
```

**✅ Good:**
```json
"build": "prisma generate && prisma migrate deploy && next build"
```

To create new migrations locally:
```bash
npx prisma migrate dev --name <descriptive_name>
```

#### 3.2 Add Indexes for Query Patterns

When adding a Prisma query that filters or sorts by a column, check that a database index exists for that pattern. Add `@@index` to the model if missing.

**Common patterns that need indexes:**
| Model | Index needed | Why |
|---|---|---|
| `Assignment` | `@@index([createdById])` | Filter by creator |
| `Assignment` | `@@index([published])` | Filter published/draft |
| `Assignment` | `@@index([dueDate])` | Sort by due date |
| `Submission` | `@@index([assignmentId, userId])` | Find user's submission for assignment (most common query) |
| `SubmissionAnswer` | `@@index([questionId])` | Group grades by question |

When in doubt, add the index. The cost of an unused index is negligible; the cost of a missing index on 10,000+ rows is a full table scan.

#### 3.3 Use `Decimal` for Scores, Not `Float`

Floating point arithmetic is imprecise. `0.1 + 0.2 = 0.30000000000000004`. All score/points fields (`totalPoints`, `score`, `points`) must use `Decimal` in the Prisma schema.

```prisma
model SubmissionAnswer {
  score  Decimal? @db.Decimal(10, 2)
}
model Question {
  points Decimal  @db.Decimal(10, 2)
}
```

On the frontend, convert with `parseFloat()` or `Number()` for display, and always round for presentation: `score.toFixed(2)`.

#### 3.4 No New `Json` Columns

Do not add new `Json` type columns. They lose referential integrity, are unqueryable, and Prisma returns `any` for them. Use proper join tables instead.

**Existing legacy `Json` columns** (do not add more like these):
- `ScheduledEmail.recipientIds` — should be a join table `ScheduledEmailRecipient`
- `GradeAppeal.imageUrls` / `AppealMessage.imageUrls` — should be a related `AppealImage` model
- `SubmissionAnswer.answerImageUrls` / `feedbackImageUrls` — should be related models

**❌ Bad:**
```prisma
model NewFeature {
  tagIds Json // stores ["id1", "id2"] — no FK constraints, no type safety
}
```

**✅ Good:**
```prisma
model NewFeature {
  tags NewFeatureTag[]
}
model NewFeatureTag {
  featureId String
  tagId     String
  feature   NewFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  tag       Tag        @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([featureId, tagId])
}
```

#### 3.5 Add `updatedAt` to All Mutable Models

Every model that can be updated after creation must have an `updatedAt` field with `@updatedAt`. Without this, you cannot tell when a record was last modified (critical for grading, submissions, appeals).

```prisma
model Submission {
  updatedAt DateTime @updatedAt
}
```

#### 3.6 Soft Delete for Student Work

Never hard-delete student work (submissions, submission answers, assignments with submissions). Use `isDeleted` + `deletedAt` fields. This provides audit trail, undo capability, and prevents accidental data loss from cascading deletes.

```prisma
model Submission {
  isDeleted Boolean   @default(false)
  deletedAt DateTime?
}
```

All queries must filter: `where: { isDeleted: false }` (add a Prisma middleware or wrapper if needed).

Soft-deleting an `Assignment` must not hide its history irrecoverably. Deleted assignments live in a staff-only recycle bin:

- `assignmentListWhere(role, filter)` in `src/lib/services/assignment-service.ts` is the single source of truth for list visibility; `filter=deleted` is the only branch that returns `isDeleted: true`, and students are always forced to `{ published: true, isDeleted: false }`.
- Any query that reaches submissions, answers, grades, appeals, or exports must also filter the parent assignment: `assignment: { isDeleted: false }` (`Submission.isDeleted` alone is not enough). Use `APPEAL_ON_LIVE_ASSIGNMENT` for appeal queues.
- Grading reads/mutations for a deleted assignment return 404, and `/grading` renders a persistent empty state ("restore it from Assignments → Deleted") instead of only a toast, so a deep link never leaves an empty grading shell behind.
- Delete confirmations must say what soft delete actually does — history is kept and the assignment can be restored. Never write "cannot be undone" for an assignment delete.
- `restoreAssignment()` clears only `isDeleted`/`deletedAt` and writes an `assignment_restored` audit log. Never re-create rows on restore.

#### 3.7 Re-read Account State on Every API Call

Sessions are JWTs, so `isDeleted`, `isBanned` and `role` claims are a snapshot from sign-in. `requireApiAuth()` calls `getAccountStatus()` (`src/lib/services/account-status.ts`) on every request: a deleted account gets 401, a banned account gets 403 with `BANNED_MESSAGE`, and the role used for authorization comes from the database, not the token. Do not read `session.user.role` directly in new API routes — use the `user` returned by `requireApiAuth()`/`requireApiRole()`.

Do not re-check `isBanned` inside a route that already calls `requireApiAuth()` — that branch is unreachable. Only two routes authenticate without it, and both must repeat the `isDeleted` (401 `DELETED_MESSAGE`) and `isBanned` (403 `BANNED_MESSAGE`) checks and read the role from the database: `api/upload/client` needs the raw `getEffectiveSession()` for the Blob callback, and `api/admin/impersonate` needs the real session rather than the impersonated one. Reuse `BANNED_MESSAGE`/`DELETED_MESSAGE` from `src/lib/api-auth.ts` so the copy stays identical everywhere.

---

### 4. API Layer

#### 4.1 Use Zod for Input Validation

Every API route must validate its request body with a Zod schema. No manual `if (!field)` checks. Define reusable schemas in `src/lib/validators/`.

**❌ Bad — manual checks, inconsistent, easy to miss fields:**
```ts
const { title, description } = await req.json();
if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
// description is never validated, could be 10MB
```

**✅ Good — Zod schema with size limits:**
```ts
// src/lib/validators/assignment.ts
import { z } from "zod";
export const CreateAssignmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  totalPoints: z.number().min(0).max(10000),
  dueDate: z.string().datetime().optional(),
  questions: z.array(QuestionSchema).min(1).max(100),
});

// In route handler:
const body = CreateAssignmentSchema.safeParse(await req.json());
if (!body.success) {
  return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
}
```

#### 4.2 Standard Response Envelope

All API responses must use a consistent shape. The client should never have to guess the response format.

**❌ Bad — every endpoint returns a different shape:**
```ts
return NextResponse.json({ success: true });           // appeals
return NextResponse.json({ appeal: updated });          // same file, different action
return NextResponse.json({ submission });               // submissions
return NextResponse.json({ success: true, submission }); // grading
```

**✅ Good — standard envelope:**
```ts
// Success:
return NextResponse.json({ data: submission });
return NextResponse.json({ data: { assignments, total, cursor } });

// Error:
return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
return NextResponse.json({ error: "Score must be between 0 and 10" }, { status: 400 });
```

Type definition:
```ts
type ApiSuccessResponse<T> = { data: T };
type ApiErrorResponse = { error: string };
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

#### 4.3 Consistent Cursor-Based Pagination

Every list endpoint must support pagination. Use **cursor-based** pagination (not offset/skip) for real-time data consistency.

**Required params:** `cursor` (string, optional), `limit` (number, default 20, max 100).
**Required response fields:** `data`, `nextCursor` (string | null), `total` (number, optional).

```ts
// API route:
const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
const cursor = searchParams.get("cursor") || undefined;

const items = await prisma.assignment.findMany({
  take: limit + 1, // fetch one extra to check if there's a next page
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: "desc" },
});

const hasMore = items.length > limit;
const data = hasMore ? items.slice(0, -1) : items;
const nextCursor = hasMore ? data[data.length - 1].id : null;

return NextResponse.json({ data: { items: data, nextCursor } });
```

**Never return unbounded result sets.** Every `findMany` must have a `take` limit.

#### 4.4 No Unbounded Queries

Never load large datasets into Node.js memory for processing. Use database-level aggregation.

**❌ Bad — loads 5,000 records to compute chart data:**
```ts
const messages = await prisma.message.findMany({
  select: { createdAt: true },
  take: 5000,
});
// Then iterate in JS to build histogram buckets
```

**✅ Good — database-level aggregation:**
```ts
const histogram = await prisma.$queryRaw`
  SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
  FROM "Message"
  WHERE "createdAt" > ${startDate}
  GROUP BY day ORDER BY day
`;
```

Or with Prisma `groupBy`:
```ts
const counts = await prisma.message.groupBy({
  by: ["createdAt"],
  _count: true,
  where: { createdAt: { gte: startDate } },
});
```

#### 4.5 Differentiated Error Responses

Return specific HTTP status codes so the client can respond appropriately (retry, show message, redirect to login, etc.).

| Status | When to use | Client action |
|---|---|---|
| 400 | Validation error (bad input) | Show field-level errors |
| 401 | Not authenticated | Redirect to login |
| 403 | Forbidden (wrong role) | Show "access denied" |
| 404 | Resource not found | Show "not found" page |
| 409 | Conflict (duplicate) | Show conflict message |
| 429 | Rate limited | Show "try again later" |
| 500 | Unexpected server error | Show generic error, log for debugging |

**❌ Bad — everything is 500:**
```ts
catch (error) {
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
```

---

### 5. Frontend

#### 5.1 No `window.alert()` or `window.confirm()`

These are blocking, unstyled, inaccessible, and break the UX. The project already has shadcn/ui and sonner installed.

**❌ Bad:**
```tsx
alert("Failed to delete assignment");
if (!window.confirm("Are you sure?")) return;
```

**✅ Good — shadcn AlertDialog for confirmations:**
```tsx
<AlertDialog open={showDelete} onOpenChange={setShowDelete}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**✅ Good — sonner for notifications:**
```tsx
import { toast } from "sonner";
toast.success("Assignment published");
toast.error("Failed to save changes");
```

#### 5.2 Error Boundaries and Loading States via Route Files

Every route group under `src/app/(main)/` must have:
- **`error.tsx`** — Next.js App Router error boundary. Catches render errors and shows a recovery UI instead of a white screen.
- **`loading.tsx`** — Next.js Suspense boundary. Shows a loading skeleton/spinner during route transitions.

**❌ Bad — manual loading state in page component:**
```tsx
const [loading, setLoading] = useState(true);
if (loading) return <div>Loading...</div>;
```

**✅ Good — `loading.tsx` in the route directory:**
```tsx
// src/app/(main)/assignments/loading.tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner";
export default function Loading() {
  return <LoadingSpinner message="Loading assignments..." />;
}
```

#### 5.3 Accessibility (WCAG 2.1 AA)

This is a university platform — accessibility compliance may be a legal requirement (Section 508).

**Rules:**
- **Use semantic HTML.** `<button>` for clickable actions, not `<div onClick>`. `<a>` for navigation, not `<span onClick>`.
- **All `<input>` must have `<label>`.** Use `htmlFor` or wrap the input in a label. Checkboxes without labels are invisible to screen readers.
- **Custom lists need ARIA roles.** `<div role="list">` with `<div role="listitem">` children, or use `<ul>`/`<li>`.
- **Focus management.** When a modal/dialog opens, focus must move to it. When it closes, focus must return to the trigger. shadcn/ui handles this if you use their `Dialog` component.
- **No color-only indicators.** Don't rely solely on color to convey information (e.g., red for error). Add icons or text.
- **Keyboard navigation.** All interactive elements must be reachable and operable via Tab/Enter/Space/Escape.

**❌ Bad:**
```tsx
<div onClick={() => selectSubmission(s.id)} className="cursor-pointer">
  {s.studentName}
</div>
```

**✅ Good:**
```tsx
<button onClick={() => selectSubmission(s.id)} className="w-full text-left hover:bg-muted">
  {s.studentName}
</button>
```

#### 5.4 No Hardcoded UI Strings

User-facing text (error messages, labels, button text, role names) should be defined in constants, not scattered as inline strings. This enables future i18n and prevents typo bugs across files.

```ts
// src/lib/ui-strings.ts or within src/lib/constants.ts
export const MESSAGES = {
  ASSIGNMENT_DELETED: "Assignment deleted successfully",
  CONFIRM_DELETE: "Are you sure you want to delete this assignment?",
  SCORE_OUT_OF_RANGE: "Score must be between 0 and {max}",
} as const;
```

---

### 6. State Management

#### 6.1 Use `useReducer` for Complex State

If a component has more than **8 `useState` calls**, it must be refactored to use `useReducer` with a typed state object and discriminated union action types. This makes state transitions explicit, debuggable, and testable.

**❌ Bad — 94 pieces of state as individual `useState`:**
```tsx
const [grades, setGrades] = useState({});
const [overallScore, setOverallScore] = useState(0);
const [overallFeedback, setOverallFeedback] = useState("");
const [feedbackImages, setFeedbackImages] = useState([]);
const [appealMessages, setAppealMessages] = useState({});
const [saving, setSaving] = useState(false);
// ... 88 more
```

**✅ Good — typed reducer:**
```tsx
interface GradingState {
  grades: Record<string, Grade>;
  overallScore: number;
  overallFeedback: string;
  feedbackImages: string[];
  saving: boolean;
}

type GradingAction =
  | { type: "SET_GRADE"; questionId: string; grade: Grade }
  | { type: "SET_OVERALL_SCORE"; score: number }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "RESET" };

function gradingReducer(state: GradingState, action: GradingAction): GradingState {
  switch (action.type) {
    case "SET_GRADE": return { ...state, grades: { ...state.grades, [action.questionId]: action.grade } };
    // ...
  }
}

const [state, dispatch] = useReducer(gradingReducer, initialState);
```

#### 6.2 Validate Deserialized State

When loading state from `localStorage`, URL params, or any external source, **always validate with Zod** before using. Include a schema version number so stale/incompatible data is detected and discarded gracefully.

**❌ Bad — untyped, unvalidated localStorage read:**
```tsx
const saved = JSON.parse(localStorage.getItem("gradingState") || "{}");
// saved is `any`, could have stale/missing fields, causes undefined errors
```

**✅ Good — validated with schema version:**
```tsx
const GradingCacheSchema = z.object({
  _version: z.literal(2), // increment when shape changes
  grades: z.record(z.string(), GradeSchema),
  overallScore: z.number(),
});

const raw = JSON.parse(localStorage.getItem("gradingState") || "{}");
const parsed = GradingCacheSchema.safeParse(raw);
if (!parsed.success) {
  localStorage.removeItem("gradingState"); // discard stale data
  return initialState;
}
return parsed.data;
```

#### 6.3 No Duplicated State Across Pages

Multiple pages showing the same data (e.g., assignments list on the assignments page and grading page) must share a single cache via React Query / SWR. If a TA creates an assignment on one page, it must be visible on the other page without a manual refresh.

Use the same `queryKey` (e.g., `["assignments"]`) across all hooks that fetch assignments. React Query will deduplicate requests and share the cache automatically.

---

### 7. Error Handling

#### 7.1 Never Silently Swallow Errors

Every `.catch()` must log the error with context. The silent `.catch(() => {})` pattern was found **dozens of times** in the codebase. Fire-and-forget operations (emails, analytics, audit logs) must still log failures — otherwise you will never know when critical subsystems are broken.

**❌ Bad — silent swallow:**
```ts
sendEmail({ to, subject, html }).catch(() => {});
trackRateLimitAbuse(userId, userName).catch(() => {});
handleContentFlag(userId, userName, message, flags).catch(() => {});
```

**✅ Good — log with context:**
```ts
sendEmail({ to, subject, html }).catch(err =>
  console.error("[email:send]", { to, subject, error: err.message })
);
trackRateLimitAbuse(userId, userName).catch(err =>
  console.error("[abuse:track]", { userId, error: err.message })
);
```

#### 7.2 Structured Logging

All log statements must follow the format: `console.error("[module:action]", { key: value })`. Include user IDs, resource IDs, and relevant context in every log entry. This makes logs searchable and debuggable in production.

**❌ Bad:**
```ts
console.error("Chat error:", error);
```

**✅ Good:**
```ts
console.error("[chat:stream]", {
  userId: auth.user.id,
  conversationId,
  model,
  error: error instanceof Error ? error.message : String(error),
});
```

#### 7.3 Map Errors to Specific HTTP Status Codes

Different errors require different client-side handling. Catch known error types and return appropriate status codes — never return generic 500 for all failures.

```ts
catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  console.error("[assignments:update]", { id, error });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

#### 7.4 Hide Features Whose External Service Is Not Configured

An action that always fails is worse than a missing action: students press it, get an opaque error, and report a bug. Never hardcode a third-party endpoint as a default either — a vendor can turn it off (the public `emkc.org` Piston instance became allow-list only and now answers 401).

Read the endpoint from an env var, return 503 from the route when it is unset, and expose availability so the UI can hide the control:

```ts
// src/lib/code-execution.ts — no default endpoint
export function codeExecutionEndpoint(): string | null {
  return process.env.CODE_EXEC_API_URL?.trim() || null;
}

// GET /api/run-code → { enabled }, consumed by useCodeExecutionAvailable()
const isRunnable = codeExecutionAvailable && RUNNABLE_LANGUAGES.includes(language);
```

The availability hook (`src/hooks/use-code-execution.ts`) caches its request in a module-level promise, so a chat page with 20 code blocks still makes one request.

---

### 8. Performance

#### 8.1 No In-Memory Rate Limiting

A per-process `Map` limiter resets on every cold start and is not shared between serverless instances, so the real limit becomes "N × configured limit". Never add one.

**Count attempts in the database instead:**
- Authenticated actions: `consumeActionRateLimit({ userId, action, limit, windowMs })` in `src/lib/services/action-rate-limit.ts`. It counts `RateLimitHit` rows in the window under a `pg_advisory_xact_lock` keyed by `action:userId` (so parallel requests cannot both pass the last slot), inserts the attempt, and prunes rows older than the window. `/api/run-code` uses it with `action: "run_code"`.
- Chat messages: `checkRateLimit` in `src/lib/rate-limit.ts` counts the user's own `Message` rows.
- Unauthenticated endpoints: `consumeAuthAttempt(kind, ip)` in `src/lib/services/auth-attempt-limit.ts` (`AuthAttempt` rows, hashed IP).

Adding a new limited action means adding it to `RateLimitedAction` and calling `consumeActionRateLimit`; no schema change is needed.

#### 8.2 Configure Database Connection Pooling

The Prisma client in `src/lib/prisma.ts` must configure connection pool size appropriate for the deployment environment. Add query logging in development to catch N+1 queries.

```ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});
```

#### 8.3 No Probabilistic Cleanup

Never run cleanup/maintenance on a random percentage of requests (e.g., `if (Math.random() > 0.01) return`). This causes unpredictable latency spikes for unlucky users and unreliable cleanup.

**✅ Use cron jobs** for all scheduled maintenance: old record cleanup, stale session purging, etc.

**Cron provider:** We use [cron-job.org](https://cron-job.org) (free) instead of Vercel crons (Hobby plan only supports daily). Cron-job.org calls our `/api/cron/*` endpoints via HTTP GET with `Authorization: Bearer <CRON_SECRET>` header. Supports per-minute intervals.

**Setup:** Create jobs at https://console.cron-job.org with:
- **URL:** `https://<your-vercel-domain>/api/cron/<job-name>`
- **Schedule:** Every 5 minutes (or as needed)
- **Headers:** `Authorization: Bearer <CRON_SECRET>`
- **Method:** GET

Current cron jobs:
| Endpoint | Recommended schedule |
|---|---|
| `/api/cron/publish-scheduled` | Every 5 minutes |
| `/api/cron/send-scheduled-emails` | Every 5 minutes |

#### 8.4 Stream-Friendly File Uploads

File uploads must not buffer entire files in server memory. Use presigned URLs (Vercel Blob, S3) so files go directly from the browser to storage.

If server-side processing is required, validate file size **before** reading the body:
```ts
const contentLength = Number(req.headers.get("content-length") || 0);
if (contentLength > 20 * 1024 * 1024) {
  return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });
}
```

#### 8.5 Don't Block Response Streams

Background tasks (AI title generation, analytics events, email sending, audit logging) must not block the HTTP response. Use fire-and-forget with error logging:

**❌ Bad — blocks SSE stream for 1-3 seconds:**
```ts
// After streaming AI response:
const title = await anthropic.messages.create({ ... }); // blocks!
await prisma.conversation.update({ data: { title } });
```

**✅ Good — async background task:**
```ts
// Don't await — fire and forget with error logging
generateTitle(conversationId, messages).catch(err =>
  console.error("[chat:generateTitle]", { conversationId, error: err.message })
);
```

#### 8.6 Lazy-Load Heavy Dependencies

Large libraries must be dynamically imported and code-split. Never import them at the top of a file that loads on every page.

| Library | Size | Usage |
|---|---|---|
| `three` / `@react-three/fiber` | ~400KB gzipped | Physics simulations only |
| `mermaid` | ~2MB | Diagram rendering only |
| `katex` | ~300KB | LaTeX rendering only |

```tsx
// ✅ Good — dynamic import
const PhysicsSimulation = dynamic(() => import("@/components/PhysicsSimulation"), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading simulation..." />,
});
```

---

### 9. Code Quality

#### 9.1 DRY: Extract Shared Patterns

Common patterns that must be extracted into shared utilities:

| Pattern | Shared location | Usage |
|---|---|---|
| Role checks (`role === "TA" \|\| role === "PROFESSOR" \|\| ...`) | `isStaff(role)` in `src/lib/constants.ts` | 15+ locations |
| Pagination UI (page buttons, prev/next, gap indicators) | `<Pagination>` component in `src/components/ui/` | 3+ pages |
| Appeal message thread rendering | `<AppealThread>` in `src/components/` | assignments detail + grading page |
| API fetch with error handling | `apiFetch()` utility in `src/lib/api-client.ts` | All frontend data fetching |
| Date formatting | Shared utility in `src/lib/utils.ts` | Multiple pages |

#### 9.2 HTML Email Templates in Separate Files

Never write HTML email templates as template literal strings inside TypeScript functions. They are impossible to preview, test, or maintain. Use separate template files:

- **Preferred:** React Email components in `src/emails/`
- **Acceptable:** `.html` template files in `src/templates/emails/`
- **❌ Bad:** Inline HTML in `src/lib/spam-guard.ts`, `src/lib/abuse-detection.ts`, or API route handlers

#### 9.3 TypeScript Strictness

- Run `tsc --noEmit` in CI to catch type errors before merge.
- Never use `any` unless absolutely necessary. If `any` is unavoidable, add a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment with a justification.
- Never use `@ts-ignore` or `@ts-expect-error` without a comment explaining why.

#### 9.4 Strict ESLint Configuration

The `.eslintrc.json` must include:
- `@typescript-eslint/strict` or equivalent strict rules
- `no-floating-promises: "error"` — prevents unhandled promise rejections
- `no-unused-vars: "error"` — prevents dead code accumulation
- `no-explicit-any: "warn"` at minimum

---

### 10. Build & Deploy

#### 10.1 Use `npm ci` in CI/CD

Always use `npm ci` (not `npm install`) in CI/CD pipelines and production builds. `npm ci` uses the exact versions from `package-lock.json` for deterministic, reproducible builds. `npm install` can modify the lock file.

#### 10.2 Pin Beta Dependencies

The project uses `next-auth@5.0.0-beta.30` — a beta dependency with no stability guarantee. Rules:
- Do not upgrade `next-auth` without thorough testing of all auth flows.
- Document the exact beta version and known issues in this file.
- If upgrading, test: credentials login, Google OAuth, session handling, impersonation, E2E test mode, and all `requireApiAuth()` / `requireApiRole()` calls.

#### 10.3 Safe Build Script

The production build command in `package.json` must be:
```json
"build": "prisma generate && prisma migrate deploy && next build"
```

**Never use** `prisma db push` or `--accept-data-loss` in any build script, CI pipeline, or deployment process. These can silently drop tables/columns and cause irreversible data loss in production.

---

### 11. AI Code Cleanup & Clean Code

#### ⚠️ Mandatory Skill Invocation

Before writing or modifying code, **you must invoke the relevant skills** using the `skill` tool. Do not rely on memory — always call the skill to get the latest instructions.

| When | Invoke skill |
|---|---|
| **Starting any coding task** | `clean-code` — to review function size, naming, SRP rules |
| **Before committing / finishing a task** | `deslop` — to check the branch diff for AI artifacts |
| **After AI-assisted coding** | `ai-code-cleanup` — to remove comments, defensive bloat, type casts |
| **Refactoring existing code** | `code-refactoring` — for extract method, guard clauses, parameter objects |
| **Designing new services or splitting components** | `architecture-patterns` — for service layer, clean architecture |
| **Reviewing any AI-generated content** | `anti-slop` — to detect generic AI patterns in code, text, or design |

**Example — at the start of a task:**
```
I'll invoke the clean-code and architecture-patterns skills before starting.
[calls skill tool with SkillName: "clean-code"]
[calls skill tool with SkillName: "architecture-patterns"]
```

**Example — before committing:**
```
Let me run deslop and ai-code-cleanup on the changes.
[calls skill tool with SkillName: "deslop"]
[calls skill tool with SkillName: "ai-code-cleanup"]
```

These rules below are derived from those skills. They apply to all code written by AI agents and must be enforced on every commit.

#### 11.1 Remove AI-Generated Comments

Comments that restate obvious code, are inconsistent with the file's documentation style, or over-document simple operations must be removed. Only keep comments that explain **why**, not **what**.

**❌ Bad — AI slop comments:**
```ts
// Set the user's name
user.name = name;

// Create a new assignment
const assignment = await prisma.assignment.create({ ... });

// Return the response
return NextResponse.json({ data: result });
```

**✅ Good — self-documenting code, no redundant comments:**
```ts
user.name = name;
const assignment = await prisma.assignment.create({ ... });
return NextResponse.json({ data: result });
```

#### 11.2 Remove Defensive Bloat

Do not add unnecessary try/catch blocks, redundant null checks on trusted/validated paths, or error handling that can never trigger. Trust validated inputs.

**❌ Bad — unnecessary defensive code on a validated path:**
```ts
function processUser(user: SessionUser) {
  try {
    if (user && user.name && typeof user.name === "string") {
      return user.name.toUpperCase();
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
```

**✅ Good — trust the typed input:**
```ts
function processUser(user: SessionUser) {
  return user.name.toUpperCase();
}
```

#### 11.3 No Type Workarounds

Do not cast to `any` to bypass type issues. Do not add `@ts-ignore` / `@ts-expect-error` without a legitimate reason and comment. Do not use unnecessary type assertions (`as X`) when the type system already knows the type.

**❌ Bad:**
```ts
const data = response.data as any;
const result = processData(data as ProcessedData);
```

**✅ Good:**
```ts
const data: ResponseData = response.data;
const result = processData(data);
```

#### 11.4 Clean Code Principles

All functions must follow Uncle Bob's Clean Code standards:

- **Small functions**: Functions should be < 20 lines. If longer, extract sub-functions.
- **Do one thing**: Each function has a single responsibility.
- **One level of abstraction**: Don't mix high-level business logic with low-level details.
- **Descriptive names**: `isPasswordValid` not `check`. `calculateTotalScore` not `process`.
- **Few arguments**: 0-2 is ideal. 3+ requires a parameter object.
- **No side effects**: Functions shouldn't secretly mutate global state.
- **No magic numbers**: Extract constants with descriptive names.

```ts
// ❌ Bad
if (user.age >= 18 && order.total >= 50) {
  applyDiscount(order, 0.1);
}

// ✅ Good
const MINIMUM_AGE = 18;
const DISCOUNT_THRESHOLD = 50;
const STANDARD_DISCOUNT = 0.1;

if (user.age >= MINIMUM_AGE && order.total >= DISCOUNT_THRESHOLD) {
  applyDiscount(order, STANDARD_DISCOUNT);
}
```

#### 11.5 Naming Conventions

Use intention-revealing, searchable, pronounceable names. Avoid generic AI-generated names.

| ❌ Generic (AI slop) | ✅ Specific |
|---|---|
| `data` | `assignmentList`, `gradingResult` |
| `result` | `validatedSubmission`, `savedGrade` |
| `item` | `question`, `submission`, `student` |
| `handleData()` | `submitGradeForQuestion()` |
| `processItems()` | `calculateAssignmentScores()` |
| `temp` | `pendingGrade`, `draftFeedback` |

- **Classes/Components**: Nouns (`GradingPanel`, `SubmissionList`). Avoid `Manager`, `Data`, `Info`.
- **Functions/Methods**: Verbs (`submitGrade`, `fetchAssignment`, `validateScore`).
- **Booleans**: Prefix with `is`, `has`, `can`, `should` (`isPublished`, `hasSubmission`).

#### 11.6 Refactoring Patterns

When touching code, apply these refactoring patterns on contact:

- **Extract method**: If a code block does one thing, move it to a named function.
- **Guard clauses**: Replace nested conditionals with early returns.
- **Parameter objects**: Replace 3+ function parameters with a typed object.
- **Replace conditionals with polymorphism**: When `switch`/`if-else` chains grow beyond 3 cases on the same discriminator.

**❌ Bad — deeply nested:**
```ts
function getDiscount(user: User, order: Order) {
  if (user) {
    if (user.isPremium) {
      if (order.total > 100) {
        return 0.2;
      }
    }
  }
  return 0;
}
```

**✅ Good — guard clauses:**
```ts
function getDiscount(user: User, order: Order) {
  if (!user) return 0;
  if (!user.isPremium) return 0;
  if (order.total <= 100) return 0;
  return 0.2;
}
```

#### 11.7 Style Consistency

All code must match the existing project style within each file. AI agents must not introduce:
- Naming conventions different from the rest of the file (camelCase vs PascalCase etc.)
- Formatting inconsistent with surrounding code
- Import organization inconsistent with existing patterns
- Unnecessary emoji in code or comments
- Overly verbose variable names or redundant intermediate variables

#### 11.8 Deslop Checklist (Run Before Every Commit)

Before committing AI-generated code, verify:
- [ ] No comments restating obvious code
- [ ] No unnecessary try/catch on trusted paths
- [ ] No `as any` or `@ts-ignore` without justification
- [ ] No redundant null checks on validated inputs
- [ ] No generic variable names (`data`, `result`, `item`, `temp`)
- [ ] No magic numbers — all constants named
- [ ] Functions are < 20 lines
- [ ] Functions do one thing
- [ ] Style matches surrounding code
- [ ] No unnecessary emoji

---

## Project Overview

Next.js 14 app with Prisma (PostgreSQL), NextAuth credentials + Google OAuth, OpenAI/Anthropic AI grading, and LaTeX rendering via `react-markdown` + `remark-math` + `rehype-katex`.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM (`@prisma/adapter-pg`)
- **Auth**: NextAuth v5 (credentials + Google)
- **AI**: chat runs on DeepSeek (`DEEPSEEK_CHAT_MODEL = "deepseek-v4-flash"`) when `DEEPSEEK_API_KEY` is set, otherwise on OpenAI (`OPENAI_CHAT_MODEL = "gpt-5.6-luna"`); see `getActiveChatModel()` in `src/lib/ai.ts`. Anthropic code paths remain for problem generation/grading fallback but are unused without `ANTHROPIC_API_KEY`
- **Styling**: Tailwind CSS, Radix UI, shadcn/ui
- **LaTeX**: `react-markdown`, `remark-math`, `rehype-katex`, `katex`

### AI Client Initialization

OpenAI/Anthropic clients in `src/lib/ai.ts` are created lazily via `getOpenAI()` / `getAnthropic()`, which throw a clear "API key is not configured" error when the corresponding env var is missing. Never instantiate these SDK clients at module load time — the app must boot and degrade gracefully without AI keys (`/api/chat` streams a friendly authentication-error message instead of returning a 500).

### Chat Streaming

- Client-side chat streaming lives in `src/hooks/use-chat-stream.ts` (`useChatStream`): sending, SSE parsing, Stop (AbortController), and Retry of failed sends. `ChatPageClient.tsx` composes the hook with UI state only.
- Failed sends are marked `error: true` on the assistant message and rendered as an error bubble (red surface + `AlertTriangle` avatar) by `ChatMessageList`, never as normal assistant text. A 403 (banned / restricted / unverified email) is treated as permanent: no `pendingRetry` is recorded, so no Retry button appears.
- Docked side panel: `SideChatLayout` + `SideChatPanel` (`src/components/chat/`) render the tutor in a resizable column beside page content (used by the assignment detail page), reusing `useChatStream` / `useChatAttachments` / `/api/chat`, so bans, restrictions, rate limits and exam mode behave exactly as on `/chat`. Passing `assignmentId` marks the panel as assignment help: `/api/chat` then uses `SOCRATIC_SYSTEM_PROMPT` regardless of the client's `mode`, so a student cannot make the tutor solve their homework, and the panel hides the Socratic toggle in favour of a permanent guided-mode banner. Exam mode still wins over both. Panel UI state is in `src/hooks/use-side-chat-panel.ts`; exam-mode lookup is shared via `src/hooks/use-exam-mode.ts`. `/chat/[id]` opens that conversation on mount through `initialConversationId`.
- `/api/chat` input is validated with `ChatInputSchema` (Zod). SSE writes go through a `send()` helper that tolerates client disconnects (Stop button) — the partial answer is still persisted.
- Chat always uses a single fixed server-side model (`getActiveChatModel()`): DeepSeek `deepseek-v4-flash` when `DEEPSEEK_API_KEY` is set, otherwise OpenAI `gpt-5.6-luna`. There is no client-side model selection and the API ignores/rejects a `model` field. Conversation titles are generated by the same active provider (`generateConversationTitle` in `src/lib/ai.ts`).
- DeepSeek streams through `streamDeepSeek` (Chat Completions), which adapts chunks to the OpenAI Responses event shapes the route consumes; `reasoning_content` deltas map to `thinking`. DeepSeek has no image input or web search — image attachments are ignored and no citations are produced while it is active.
- Web search runs via OpenAI's `web_search_preview` tool. `url_citation` annotations are collected during the stream and appended to the answer as a markdown `**Sources:**` list, so citations persist in the DB and render as links.
- Conversation folders: users can organize chats into folders (`ConversationFolder` model; `Conversation.folderId` nullable, `onDelete: SetNull` so deleting a folder keeps its conversations). CRUD in `src/lib/services/conversation-folder-service.ts` via `/api/folders` + `/api/folders/[id]`; moving a chat is `PATCH /api/conversations/[id]` with `{ folderId }`. Client state in `src/hooks/use-conversation-folders.ts`; sidebar UI in `ChatSidebar.tsx` composing `FolderSection.tsx` / `ConversationItem.tsx`.
- Scroll position is owned by `useStickyScroll` (`src/hooks/use-sticky-scroll.ts`): the reader counts as pinned until they scroll more than 80px above the bottom, new content only follows while pinned, and a `ResizeObserver` re-pins after markdown/KaTeX/images change the content height. Pinned state is never measured on mount, so opening a conversation always lands on the newest message. When not pinned, `ChatMessageList` shows a "Jump to latest" button (absolutely positioned over the scroll container, not inside it — a sticky child inside the message list renders behind the bubbles). Never restore the old "scroll to bottom on every `messages` change" effect; it fights the reader.
- Conversation export: `src/components/chat/export-conversation.ts` (Markdown download; PDF via `window.print()` scoped to `#chat-print-area` by `@media print` rules in `globals.css`).
- Context window: `/api/chat` sends the model only the newest `CONTEXT_WINDOW_MESSAGES` (50) messages. Older history is kept alive through a rolling summary (`Conversation.contextSummary` + `contextSummaryCount` = how many of the oldest messages the summary covers) maintained by `refreshContextSummary` in `src/lib/services/conversation-summary-service.ts`: once ≥10 unsummarized messages have aged out of the window, they are folded into the prior summary via `summarizeConversation(messages, priorSummary)` (one AI call per batch, each message truncated to 4,000 chars). The route appends the summary to whatever system prompt is active with `appendContextSummary` and awaits the refresh after saving the assistant message but **before** closing the SSE stream (serverless would kill post-response work). The refresh must never recurse into chat streaming, and skips entirely when no provider key is configured.

## Design System

Visual language is editorial, not "AI dashboard": warm off-white surfaces, stone neutrals, a muted navy primary, hairline borders, `0.375rem` radius, and almost no gradients or shadows.

Full spec: [`docs/design-system.md`](./docs/design-system.md). Read it before adding UI.

- Theme tokens live in `src/app/globals.css`; `tailwind.config.ts` maps `gray`/`neutral` to Tailwind `stone` so legacy `text-neutral-*` classes stay on-palette, and adds the `brand-50..950` navy scale.
- Typography stays on Geist throughout. Sizes come from the named scale in `tailwind.config.ts` (`text-label`/`caption`/`body`/`body-lg`/`subheading`/`heading`/`title`/`display`), each of which carries its own line-height and tracking. `h1`/`h2`/`h3` are sized in the base layer — do not restate sizes per page, and do not add arbitrary `text-[28px]` values.
- Layout: `MainLayoutClient` wraps routes in `.page-shell` (`max-w-shell`, centred, `px-gutter py-8`); `FULL_BLEED_ROUTES` (`/chat`, `/simulations`) opt out. Pages compose with `.page-sections` → `.page-header` / `.page-title` / `.page-lede`, `gap-gutter` between cards, `.measure` for prose, `.grid-12` for asymmetric page grids. Pages must not set their own outer padding.
- Elevation is limited to `shadow-hairline` / `shadow-raised` / `shadow-overlay`.
- `.eyebrow` — small uppercase label above headings and stat figures.
- `StatBand` (`src/components/ui/stat-band.tsx`) is the only approved way to show a row of headline figures. Do **not** reintroduce gradient stat cards or icon-in-circle stat grids; the `gradient-card-*` utilities were removed.
- Chart styling comes from `src/lib/chart-theme.ts` (`CHART_TOOLTIP_STYLE`, `CHART_SERIES_COLORS`) and, for activity categories, `CATEGORY_COLORS` in `src/lib/constants.ts`. Never hardcode hex colors in Recharts — use `hsl(var(--chart-N))` and `hsl(var(--border))`, and do not branch chart colors on `resolvedTheme`; tokens already handle dark mode.
- Dashboard cards use `.card-minimal` with a hairline header rule, `.section-title`, and text-first empty states. No icon-in-circle accents, no `rounded-xl`/`rounded-2xl`, no `shadow-sm` floating cards.
- The navigation rail is an ink surface: use the `sidebar-*` Tailwind colors (`bg-sidebar`, `text-sidebar-muted`, `bg-sidebar-active`, `border-sidebar-border`) in `Sidebar.tsx`, never `bg-white`/`bg-gray-*`. The content area is plain `bg-background` with `bg-card` surfaces on top — no background textures, grids or tints behind content.
- `--signal` (copper, `text-signal`/`bg-signal`) is the only accent: active-nav bar, wordmark, badges, `.eyebrow-signal`, `.section-index`. Never use amber/indigo/violet accents, and never fill large areas with the signal color.
- Section headings inside a page use `.section-rule` + `.section-index` + `.eyebrow` (numbered rule), not a bare `<h2>` with a bottom border.
- Labels must say what is actually measured: "visits" for `UserActivity` rows, "messages" for chat messages, "events" for the mixed heatmap, and "sessions" only for gap-derived sessions (see below).

## Activity & Usage Metrics

Shared activity contracts live in `src/lib/activity.ts` (categories, filter groups, `MAX_ACTIVITY_DURATION_MS`, `toDateKey`, `resolveTimezone`) and `src/types/activity.ts`. The old `src/lib/track-activity.ts` was removed — import from `@/lib/activity`.

- **Time**: `useTrackTime` (`src/lib/use-track-time.ts`) measures *foreground* time only — the clock pauses on `visibilitychange`, flushes every 60s / on `pagehide` / on unmount, and each flush sends the running total which `POST /api/activity` overwrites (idempotent). Durations are validated finite + non-negative with Zod and capped at `MAX_ACTIVITY_DURATION_MS` (2h per visit).
- `/api/analytics` returns `trackedStudyMinutes` — the sum of recorded `UserActivity.durationMs`. The previous `estimatedStudyMinutes` (`totalMessages * 1.5`) heuristic was removed; never estimate time from message counts.
- **Counts**: `UserActivity` rows are page visits. The heatmap intentionally mixes activity rows, user chat messages, and submissions, so it is labeled "events recorded per day" — never call that total a session count.
- **Sessions**: derived from visit timestamps, not stored. `summarizeSessions()` in `src/lib/activity.ts` walks a single user's visits in order and starts a new session when a visit begins more than `SESSION_GAP_MS` (30 min) after the previous visit ended; a session's length spans its first visit's start to its last visit's end, so overlapping tabs are not double counted. `/api/analytics` uses that helper; `/api/admin/user-activity` computes the same rule in SQL with window functions (`sessionCount`, `avgSessionMs`) so it stays a single aggregate query. Sessions must always be grouped per user before splitting on the gap.
- **Timezone**: any user-facing day bucketing must go through `toDateKey(date, tz)` with `resolveTimezone(searchParams.get("tz"))`; clients pass `?tz=` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.

## Testing

### Prerequisites

1. PostgreSQL database running (see `docker-compose.yml`)
2. `.env` file configured with `DATABASE_URL` and `NEXTAUTH_SECRET`
3. Playwright + Chromium installed:
   ```bash
   npm install -D @playwright/test
   npx playwright install chromium
   ```

### E2E Test Mode

The app supports an `E2E_TEST_MODE` environment variable that bypasses NextAuth for Playwright tests:

- **Middleware** (`src/middleware.ts`): Skips JWT auth redirect when `E2E_TEST_MODE=true`
- **Session** (`src/lib/impersonate.ts`): `getEffectiveSession()` reads a `e2e-test-user-email` cookie and builds a fake session from the DB instead of using NextAuth

**⚠️ Never set `E2E_TEST_MODE=true` in production.**

### Running E2E Tests

```bash
# 1. Seed test data (creates test student + TA users, assignment, graded submission, appeal)
npx tsx e2e/seed-test-data.ts

# 2. Start the dev server with E2E test mode enabled
E2E_TEST_MODE=true npm run dev

# 3. Run Playwright tests (in a separate terminal)
npx playwright test

# Run with visible browser
npx playwright test --headed

# Run a specific test file
npx playwright test e2e/grading-latex-images.spec.ts

# View HTML report after tests
npx playwright show-report
```

### Test Users (seeded by `e2e/seed-test-data.ts`)

| Role    | Email                    | Password          |
|---------|--------------------------|--------------------|
| Student | `test-student@e2e.local` | `TestPassword123!` |
| TA      | `test-ta@e2e.local`      | `TestPassword123!` |

### Test Structure

```
e2e/
├── helpers.ts                      # loginAsTestUser(), loginAndGoto() helpers
├── seed-test-data.ts               # Seeds test users, assignment, graded submission, appeal
├── grading-latex-images.spec.ts    # Tests for LaTeX rendering + image attachments
└── fixtures/                       # Auto-generated test images (gitignored)
```

### Current Test Coverage

**`grading-latex-images.spec.ts`** — 6 tests:

- **Student: feedback renders LaTeX with KaTeX** — Verifies `.katex` elements exist in graded feedback
- **Student: appeal thread renders LaTeX with KaTeX** — Verifies LaTeX in appeal reason + TA reply
- **Student: can attach images to appeal reply** — Uploads image, verifies thumbnail preview
- **TA: grading page shows appeal and feedback content** — Verifies appeal section visible
- **TA: can attach images to grading feedback** — Uploads image to feedback area
- **TA: can attach images to appeal reply** — Uploads image to appeal reply area

**`chat-scroll.spec.ts`** — 1 test: opening a long conversation lands on the newest message, scrolling up reveals "Jump to latest", and the button returns the reader to the bottom. Seeds and removes its own 40-message conversation via Prisma.

### Writing New Tests

Use the cookie-based auth helper to skip login UI:

```typescript
import { loginAsTestUser, TEST_STUDENT_EMAIL } from "./helpers";

test("my test", async ({ page }) => {
  await loginAsTestUser(page.context(), TEST_STUDENT_EMAIL);
  await page.goto("/assignments");
  // ...
});
```

## Assignment Publishing & Notification Flow

Both the assignment detail page (`src/app/(main)/assignments/[id]/page.tsx`) and the create assignment page (`src/app/(main)/assignments/create/page.tsx`) use a shared `NotifyUsersDialog` component (`src/components/ui/notify-users-dialog.tsx`).

1. **Publish Confirm** — Simple dialog confirming the publish action
2. **Notify Users Dialog** — After publishing, a shared dialog opens allowing the instructor to email users:
   - Recipients list with role-based filter tabs: **All**, Students, TAs, Professors, Admins (with counts)
   - Individual user checkboxes with name, role badge, and email
   - "Select All" / "Deselect All" toggle — operates on the **currently visible** users only
   - Pre-filled editable Subject and Message fields
   - "Skip" to close without sending, "Send Reminder" to email selected users
   - All users are pre-selected by default
   - Fetches users from `/api/admin/users` and sends via `/api/admin/email`
   - Success state with checkmark before auto-closing, including sent/failed/skipped counts
   - Props: `open`, `onOpenChange`, `defaultSubject`, `defaultMessage`, `onSkip?`, `onSent?`
   - Optional props for customization: `onBeforeSend?`, `dialogTitle?`, `dialogDescription?`, `sendButtonLabel?`, `successMessage?`

### Notification Recipients & Audience Targeting

The role tabs are a **view filter only** — they never change the selection. Selecting the "Student" tab does not deselect TAs, so the dialog discloses hidden selections instead of silently sending to everyone.

**Composition:**
- `src/lib/notify-selection.ts` — pure selection helpers (`visibleUsersFor`, `countSelected`, `toggleVisibleSelection`, `selectedRoles`), unit-tested in `e2e/notify-selection.spec.ts`
- `src/hooks/use-notify-recipients.ts` — loads `/api/admin/users`, owns the selection Set, derives `visibleUsers`, `visibleSelectedCount`, `hiddenSelectedCount`, `allVisibleSelected`, `selectedRoles`
- `src/hooks/use-email-templates.ts` — loads `/api/admin/email-templates`
- `src/components/ui/notify/recipient-picker.tsx` — role tabs, counts, and the amber "N more selected recipients from other roles are hidden" warning
- `src/components/ui/notify-users-dialog.tsx` — composes the above; keeps subject/message/schedule state only

**Audience targeting:** `Notification.audienceRoles` and `ScheduledEmail.audienceRoles` (`Role[]`) restrict who sees an in-app notification. Empty means everyone. The dialog derives the audience from the roles present in the selection and passes it through `onBeforeSend(subject, message, { scheduledAt?, audienceRoles })` to `POST /api/notifications`, and to `POST /api/admin/scheduled-emails` for scheduled sends. `GET /api/notifications`, mark-all-read, and `POST /api/notifications/[id]/read` all filter by audience, so a staff-only announcement is never returned to students.

**Delivery honesty:**
- `sendBulkEmails` filters out banned and soft-deleted users server-side and returns `skippedCount`; client filtering is never authoritative
- `POST /api/admin/email` returns `sentCount` / `failedCount` / `skippedCount`, recorded in the audit log
- With "Also send as email" unchecked the dialog states that no email is sent (in-app only) instead of implying delivery
- Scheduled sends reject malformed and past datetimes on both the client (`parseFutureDate`) and the API

**Unpublish** uses a simple destructive confirm dialog (no notify step).

### Grade Appeal Emails

`src/lib/services/appeal-notification-service.ts` owns every appeal email; `POST`/`PATCH /api/appeals` only pass primitives to it and swallow nothing (failures are logged, never rolled back into the appeal write, so a mail outage cannot lose an appeal).

Recipient rules — `resolveAppealRecipients(submissionId)`:

- `Submission.gradedById` points at an active user → that grader alone (`audience: "grader"`).
- No grader, or the grader is banned/soft-deleted → every `role: "TA"` user with `isBanned: false, isDeleted: false` (`audience: "all_tas"`). This is the fully auto/AI-graded case. **Professors and admins are never included** — do not "helpfully" widen this set.

Direction rules — `notifyAppealPatch`:

- Student files an appeal or replies in the thread → mail the grader/TA audience above.
- Staff (TA/professor/admin) reply or resolve/reject → mail **only the student who filed the appeal**, never other staff.

Templates live in `src/lib/email-templates.ts`: `gradeAppealEmail` (to graders/TAs) and `appealReplyEmail` (to the student).

There is no in-app appeal notification: the `Notification` model is announcement-shaped (global, no per-user or per-role audience), so appeals are email-only until notifications gain an audience.

Recipient selection is covered by `e2e/appeal-notification.spec.ts` (grader-only, all active TAs with professor/admin/banned/deleted excluded, deleted-grader fallback).

### Scheduled Emails

All email/notification sending through `NotifyUsersDialog` supports scheduling for later delivery.

**Schema:** `ScheduledEmail` model with fields:
- `subject`, `message` (`@db.Text`), `scheduledAt` (`DateTime`), `recipientIds` (`Json` — string array of user IDs)
- `createdById` (relation to `User`), `status` (`ScheduledEmailStatus` enum: `PENDING`, `SENT`, `CANCELLED`, `FAILED`)
- `createNotification` (`Boolean`, default `false`) — Also create in-app notification when email is sent
- `audienceRoles` (`Role[]`) — Roles the generated in-app notification is visible to; empty means everyone
- `sentAt`, `cancelledAt` (`DateTime?`), `error` (`@db.Text?`)

**Cron job:** `GET /api/cron/send-scheduled-emails` — called every 5 minutes via [cron-job.org](https://cron-job.org). Queries `ScheduledEmail` where `status = PENDING AND scheduledAt <= now()`, sends emails, optionally creates in-app notifications, updates status, creates audit logs. Protected by `CRON_SECRET`.

**API routes:**
- `GET /api/admin/scheduled-emails` — List all scheduled emails (staff only)
- `POST /api/admin/scheduled-emails` — Create a scheduled email (`subject`, `message`, `scheduledAt`, `recipientIds`, `createNotification?`, `audienceRoles?`, `assignmentId?`); Zod-validated, `recipientIds` may be empty only when `createNotification` is true (in-app only)
- `GET /api/admin/scheduled-emails/[id]` — Get single scheduled email
- `PATCH /api/admin/scheduled-emails/[id]` — Update or cancel (`status: "CANCELLED"`) a pending scheduled email
- `DELETE /api/admin/scheduled-emails/[id]` — Delete a scheduled email record

**UI — NotifyUsersDialog** (`src/components/ui/notify-users-dialog.tsx`):
- New props: `enableScheduling` (default `true`), `onScheduled?`
- Schedule mode is entered via `defaultScheduledAt` or `schedulePublishMode`, which shows the datetime picker
- Button label changes to "Schedule" with `CalendarClock` icon when in schedule mode
- Creates scheduled email via `/api/admin/scheduled-emails` POST instead of sending immediately

**UI — Admin Page** (`src/app/(main)/admin/scheduled-emails/page.tsx`):
- Stats cards: Pending, Sent, Cancelled, Failed counts
- Filter tabs by status
- Expandable email rows showing message, error details, timestamps
- Cancel (pending emails) and Delete (completed/cancelled/failed) actions with confirmation dialogs
- Accessible via sidebar under ADMIN → Scheduled Emails

### Email Templates

Reusable templates for emails and notifications, accessible from the `NotifyUsersDialog` and a dedicated admin page.

**Schema:** `EmailTemplate` model with fields:
- `name`, `subject`, `message` (`@db.Text`), `category` (default `"general"`)
- `createdById` (relation to `User`), `createdAt`, `updatedAt`
- Categories: `general`, `assignment`, `grade`, `announcement`, `reminder`

**API routes:**
- `GET /api/admin/email-templates` — List all templates (staff only)
- `POST /api/admin/email-templates` — Create a template (`name`, `subject`, `message`, `category?`)
- `GET /api/admin/email-templates/[id]` — Get single template
- `PATCH /api/admin/email-templates/[id]` — Update template fields
- `DELETE /api/admin/email-templates/[id]` — Delete a template

**UI — NotifyUsersDialog** (`src/components/ui/notify-users-dialog.tsx`):
- Template picker dropdown appears above Subject/Message fields when templates exist
- Grouped by category in `<optgroup>` elements
- Selecting a template auto-fills Subject and Message fields (still editable)
- Fetches templates from `/api/admin/email-templates` when dialog opens

**UI — Admin Page** (`src/app/(main)/admin/email-templates/page.tsx`):
- Category filter tabs with counts
- Card grid layout showing template name, subject preview, message preview, category badge
- Create/Edit dialog with name, category, subject, message fields
- Delete with confirmation dialog
- Accessible via sidebar under ADMIN → Email Templates

**Seed script:** `prisma/seed-email-templates.ts` — Seeds 10 default templates:
- **Assignment**: Assignment Published
- **Grade**: Assignment Graded, Grade Appeal Response
- **Announcement**: General Announcement, Class Cancelled
- **Reminder**: Assignment Due Reminder, Office Hours Reminder, Exam Reminder
- **General**: Welcome to Course, Course Feedback Request

Run with: `npx tsx prisma/seed-email-templates.ts`

### Announcements

The Topbar notification bell (`src/components/layout/Topbar.tsx`) also uses `NotifyUsersDialog` for creating announcements. Clicking "New Announcement" opens the shared dialog with `onBeforeSend` that creates the in-app notification via `/api/notifications` before sending emails — all in a single step. Announcements can also be scheduled for later delivery using the scheduling option in the dialog. Editing existing announcements uses a separate simple dialog (title + message only, no email).

### Scheduled Publishing

Assignments can be scheduled to auto-publish at a future date/time. The schedule publish flow uses the same `NotifyUsersDialog` as regular publishing, with an added datetime picker (`schedulePublishMode` prop). Both email and in-app notification are scheduled via `ScheduledEmail` and sent at the scheduled time by the `send-scheduled-emails` cron.

**Schema fields** on `Assignment`:
- `scheduledPublishAt` (`DateTime?`) — When to auto-publish (null = no schedule)
- `notifyOnPublish` (`Boolean`, default `false`) — Legacy field; new flow uses `ScheduledEmail` with `createNotification: true`

**State logic:**
| `published` | `scheduledPublishAt` | Meaning |
|---|---|---|
| `false` | `null` | Draft |
| `false` | future date | Scheduled |
| `true` | any / null | Published |

**Cron jobs:**
- `GET /api/cron/publish-scheduled` — Every 5 minutes. Publishes assignments where `scheduledPublishAt <= now() AND published = false`, skipping those with PENDING `ScheduledEmail` (handled by `send-scheduled-emails` cron instead). Protected by `CRON_SECRET`.
- `GET /api/cron/send-scheduled-emails` — Every 5 minutes. Sends pending scheduled emails, creates in-app notifications if `createNotification=true`, and publishes linked assignments after sending.

**API changes:**
- `PATCH /api/assignments/[id]` — Accepts `scheduledPublishAt` (ISO string or null) and `notifyOnPublish` (boolean). Validates future date. Clears schedule on immediate publish/unpublish. **Also cancels any PENDING `ScheduledEmail` records linked to the assignment** when the schedule is cleared (publish, unpublish, or explicit cancel).
- `POST /api/assignments` — Accepts optional `scheduledPublishAt` and `notifyOnPublish` on creation.
- `GET /api/assignments` — Supports `filter=scheduled` (unpublished with schedule set). `filter=drafts` now excludes scheduled assignments.
- `GET /api/notifications` — For staff users (TA/PROFESSOR/ADMIN), also returns `scheduledItems[]` containing PENDING scheduled emails with `createNotification=true`. Each item has `isScheduled: true` and `scheduledAt` fields.

**UI changes:**
- **Create page** (`src/app/(main)/assignments/create/page.tsx`) — "Schedule Publish" button directly opens `NotifyUsersDialog` with `schedulePublishMode`. User picks datetime, recipients, subject/message in the same dialog. "Schedule" creates the assignment + `ScheduledEmail`. "Schedule without notification" creates the assignment with `scheduledPublishAt` only.
- **Detail page** (`src/app/(main)/assignments/[id]/page.tsx`) — Blue "Scheduled: Mar 15, 2:00 PM" badge replaces "Draft" when scheduled. "Schedule" button opens `NotifyUsersDialog` with `schedulePublishMode` and `assignmentId`. "Cancel Schedule" button opens a confirmation dialog (not `window.confirm`) that cancels the schedule and any linked PENDING scheduled emails.
- **List page** (`src/app/(main)/assignments/page.tsx`) — "Scheduled" filter tab. Scheduled assignments show publish date badge.
- **Topbar** (`src/components/layout/Topbar.tsx`) — Staff users see a "Scheduled" section at the top of the notification dropdown showing PENDING scheduled notifications with a `CalendarClock` icon and scheduled time label.

**NotifyUsersDialog `schedulePublishMode` prop:**
When `schedulePublishMode=true`, the dialog shows a datetime picker at the top, hides the "Also send as email" toggle (always sends email), and creates a `ScheduledEmail` with `createNotification=true`. The `onBeforeSend` callback receives a `{ scheduledAt?, audienceRoles }` context object as its third parameter and can return an `assignmentId` string for linking. The `onSkip` callback receives `scheduledAt` as a parameter.

**Env vars:**
- `CRON_SECRET` — Required for production. Vercel sends this as `Authorization: Bearer <secret>` header.

### Mobile-Responsive Assignment Header

The assignment detail header is responsive:
- **Desktop**: Back arrow + title/badges/metadata full-width on top, action buttons in a flex-wrap row below
- **Mobile**: Title scales down (`text-xl`), action buttons use a 3-column grid (`grid-cols-3 sm:flex`) with smaller text (`text-xs sm:text-sm`) and icons (`h-3.5 w-3.5 sm:h-4 sm:w-4`)

### Shared Utilities & Constants

Duplicated pure functions and constant maps are consolidated into shared modules:

- **`src/lib/diagram-utils.ts`** — `getDiagramContent(diagram)`: Extracts diagram content from various formats (Prisma JSON, raw SVG string, etc.). Used by assignment detail and edit pages.
- **`src/lib/constants.ts`** — Shared constant maps:
  - `CATEGORY_LABELS`: Activity category display labels (e.g., `AI_CHAT` → `"AI Chat"`)
  - `CATEGORY_COLORS`: Activity category chart colors as theme tokens (`hsl(var(--chart-N))`), plus `CATEGORY_COLOR_FALLBACK`. Single source of truth — the admin activity API imports it instead of redeclaring its own map.
  - `ROLE_BADGE_COLORS`: Tailwind classes for role badges (ADMIN, PROFESSOR, TA, STUDENT)
- **`src/lib/utils.ts`** — Added shared utility functions:
  - `formatDuration(ms)`: Formats milliseconds as human-readable duration (`"<1s"`, `"5m 30s"`, `"1h 30m"`)
  - `timeAgo(dateStr)`: Formats a date string as relative time (`"just now"`, `"5m ago"`, `"3d ago"`)

### Shared UI Components

- **`src/components/ui/loading-spinner.tsx`** — `<LoadingSpinner />`: Reusable loading spinner with optional `message` prop and `className` override. Used across 7+ pages for page-level loading states.
- **`src/components/ui/empty-state.tsx`** — `<EmptyState icon={Icon} title="..." description="..." />`: Reusable empty state card with Lucide icon, title, optional description, and optional `children` slot for action buttons. Accepts `className` override.

### Shared Assignment Form

**`src/components/assignments/AssignmentForm.tsx`** — Shared form component used by both the create and edit assignment pages. Contains all common form state, handlers, and JSX (~620 lines).

**Exports:**
- `AssignmentForm` — The shared form component

Form types now live in **`src/types/assignment.ts`** (`QuestionFormData`, `AssignmentFormData`, `QuestionPayload`) so the form, the question list hook, and the LaTeX import dialog share them. Question state (add/remove/reorder, option edits, staged images, import) lives in **`src/hooks/use-question-list.ts`**; the question UI lives in **`src/components/assignments/QuestionsSection.tsx`**.

**Props:**
- `mode`: `"create" | "edit"` — Currently informational
- `initialData?`: `Partial<AssignmentFormData>` — Pre-populated data (edit mode). Synced into state via `useEffect`.
- `showDiagrams?`: `boolean` — Show diagram rendering in question cards (edit mode)
- `backHref`: `string` — Back link URL
- `title` / `subtitle`: Page header text
- `extraContent?`: `React.ReactNode` — Rendered after questions, before actions (used for schedule options card)
- `renderActions`: Callback receiving `{ formData, getQuestionsWithUrls, titleValid }` — Parent renders action buttons

**Page wrappers:**
- **`src/app/(main)/assignments/create/page.tsx`** (~302 lines) — Handles POST, publish, schedule, LaTeX export, NotifyUsersDialog
- **`src/app/(main)/assignments/[id]/edit/page.tsx`** (~178 lines) — Handles fetch, PATCH, LaTeX export with AssignmentForm

### LaTeX Question Import

TAs can build an assignment from LaTeX instead of typing questions one by one. Entry point: the **Import from LaTeX** button in `QuestionsSection`, which opens `src/components/assignments/LatexImportDialog.tsx`.

- **`src/lib/latex-import.ts`** — pure parser. `parseLatexAssignment(tex)` returns `{ title, description, questions, issues }` and throws `LatexImportError` only when nothing parseable is found. Limits: `MAX_IMPORT_LENGTH` (500k chars), `MAX_IMPORT_QUESTIONS` (200).
  - Question headers: `\textbf{Question N} (P points)` (the `export-latex` format) and `\question[P]` (exam class).
  - Options: `enumerate`, `itemize`, `choices`, `oneparchoices`, `\choice`, `\CorrectChoice`.
  - Answers: `\textbf{Answer:} ...`, `\answer{...}`, `\correctanswer{...}`, `Answer:`/`Ans:`/`答案:` (multi-line answers are kept whole).
  - Type inference: options → `MC`; no options + finite number → `NUMERIC`; otherwise `FREE_RESPONSE`.
  - MC keys are normalized through `normalizeMcAnswerKey` so letters, 1-based indices, and exact option text all resolve to a letter.
  - `\title` → assignment title (`\\` splits off a subtitle), leading prose and `\section*{...}` headings → description; `\author`/`\date` ignored.
  - Per-question problems become `issues` (`{ questionNumber, severity, message }`) instead of aborting the import.
- **`src/lib/latex-import-archive.ts`** — `readLatexImport(File | string)` accepts pasted LaTeX, a `.tex`, or the `.zip` produced by `Export LaTeX`. Archive entries are filtered for absolute/`..` paths and capped at 500 entries; images within `MAX_UPLOAD_BYTES` are staged as `imageFile` (uploaded by the existing `/api/upload` flow on save) and `.svg` files become `diagram: { type: "svg", content }`. A `.tex` that references figures it cannot carry produces per-question warnings.
- **`src/lib/latex-import-example.ts`** / **`docs/latex-import-example.tex`** — the example TAs can download from the dialog.
- Tests: `e2e/latex-import.spec.ts` (parser + archive only, no browser or DB needed).

### API Auth Middleware

Shared authentication/authorization helpers live in **`src/lib/api-auth.ts`**:

- **`requireApiAuth()`** — Returns `{ user, session }` (with typed `ApiUser`) or a `NextResponse` 401. Uses `getEffectiveSession()` so impersonation works.
- **`requireApiRole(roles: UserRole[])`** — Same as above but also checks role, returning 403 if not in the allowed list.
- **`isErrorResponse(result)`** — Type guard: `result is NextResponse`. Use after calling either helper to early-return errors.

**Usage pattern** in API routes:
```ts
import { requireApiAuth, requireApiRole, isErrorResponse } from "@/lib/api-auth";

// Auth-only
const auth = await requireApiAuth();
if (isErrorResponse(auth)) return auth;
const userId = auth.user.id;

// Auth + role guard
const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
if (isErrorResponse(auth)) return auth;
```

**Note:** `src/app/api/admin/impersonate/route.ts` intentionally uses `auth()` directly (needs the real session, not the impersonated one).

### Password Reset Flow

Email-based forgot/reset password for credentials accounts:

- **Pages**: `/forgot-password` (request link) and `/reset-password?token=...` (set new password), both under `src/app/(auth)/`. Login page links to `/forgot-password`.
- **API**: `POST /api/auth/forgot-password` (Zod-validated email, IP rate-limited via `consumeAuthAttempt("forgot_password", ...)`, always returns a generic success message to prevent account enumeration) and `POST /api/auth/reset-password` (Zod-validated token + password with the same complexity rules as registration).
- **Service**: `src/lib/services/password-reset-service.ts` — generates a 32-byte random token, stores only its SHA-256 hash in `PasswordResetToken` (30-minute expiry, one-time use via `usedAt`, prior tokens deleted on new request), and emails the raw token link using `passwordResetEmail` from `src/lib/email-templates.ts`.
- **Schema**: `PasswordResetToken` model (`tokenHash` unique, `userId` cascade FK). Google-only accounts (no `passwordHash`) and deleted users are silently ignored.
- **Rate limiting**: `consumeAuthAttempt(kind, ip)` in `src/lib/services/auth-attempt-limit.ts` for unauthenticated endpoints (DB-backed, see below).

### Email Verification (self-registration)

- **Flow**: `POST /api/auth/register` creates an *unverified* account and emails a link to `/verify-email?token=...`; `POST /api/auth/verify-email` either consumes a token or (given `{ email }`) resends the link with a deliberately generic response.
- **Service**: `src/lib/services/email-verification-service.ts` — 32-byte token, only its SHA-256 hash stored in `VerificationToken` (24h expiry, prior tokens deleted), sets both `emailVerified` and `isVerified` on success.
- **Registration**: `src/lib/services/registration-service.ts` — normalizes email, returns one generic failure for both duplicate email and duplicate `studentId` (no account enumeration), never activates an account when email delivery fails.
- **Gates**: `/api/chat` and `/api/upload/client` reject users with `emailVerified == null`. Google sign-in marks the account verified in the NextAuth `events.signIn` hook. Accounts created before this feature were grandfathered in by the migration's backfill `UPDATE`.

### Google Sign-In

- **Config**: `src/lib/google-auth.ts` owns every Google decision — `isGoogleAuthConfigured` (both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` present), `isAllowedGoogleEmail` (domain allow-list from `GOOGLE_ALLOWED_EMAIL_DOMAINS`, default `gapp.nthu.edu.tw`), and `signInErrorMessage` for NextAuth `?error=` codes.
- **Provider**: added to `src/lib/auth.ts` only when configured, so an unconfigured deployment shows no Google button instead of a broken one. `allowDangerousEmailAccountLinking` is intentional: the domain is fixed and Google proves the address, so a student who registered with a password can also sign in with Google.
- **Gates**: the `signIn` callback rejects emails outside the allow-list, unverified Google emails, and banned/soft-deleted users.
- **UI**: `/login` and `/register` are server components that pass `googleEnabled` and the decoded error message into their client halves; the button lives in `src/components/auth/GoogleSignInButton.tsx`.
- **Console setup** (project `physics-tutor-platform`, client "Platform Login"): redirect URIs must be `<origin>/api/auth/callback/google` for both localhost and the deployed origin, scopes stay `openid email profile` (non-sensitive, so the 100-user cap does not apply), publishing status "In production".
- **Types**: `src/types/next-auth.d.ts` declares `session.user.role` and the JWT fields, which replaced the `any` casts in the callbacks.

### Unauthenticated Rate Limits (`AuthAttempt`)

`src/lib/services/auth-attempt-limit.ts` counts attempts per SHA-256-hashed IP in the `AuthAttempt` table (5/hour per `kind`: `register`, `verify_resend`, `forgot_password`). DB-backed because in-memory counters are per-instance on Vercel and therefore ineffective. The chat message limit in `src/lib/rate-limit.ts` counts the user's own `Message` rows in the window for the same reason (`checkRateLimit` is now async).

### Chat Attachments (images + PDF/Markdown/text)

- **Limits** live only in `src/lib/chat-attachments.ts` and are shared by client pre-flight and server enforcement: 5 attachments per message; 5 MB per image, 10 MB per PDF, 1 MB per `.md`/`.txt`; 60 image uploads/hour; 30 documents and 150 MB of documents per rolling day (images deliberately excluded from the daily budget). Types are classified server-side from MIME type *and* extension, because Markdown often arrives with an empty MIME type.
- **Quota**: `src/lib/services/upload-quota.ts` counts `UploadEvent` rows. `/api/upload/client` authenticates, rejects deleted/banned/unverified users, validates the client payload with Zod, and records the `UploadEvent` when issuing the Blob token — deliberately conservative: an abandoned upload still costs quota. `GET /api/upload/quota` exposes remaining allowances so the UI can explain a rejection before uploading.
- **Extraction**: `src/lib/services/document-extraction.ts` (unpdf) downloads the blob, re-checks the *actual* byte size against the limit, reads at most 30 PDF pages and truncates to 30k chars. Text is persisted on `MessageAttachment` so later turns reuse it instead of re-downloading.
- **Model context**: `src/lib/services/chat-context.ts` inlines document text as `<document>` blocks with an instruction that file contents are data, filenames stripped of quoting characters and `</document>` neutralized. Provider-independent, so DeepSeek (no vision/document support) works too.
- **Client**: `src/hooks/use-chat-attachments.ts` owns staging, validation, previews and upload; `ChatInput` renders image previews plus document chips, `MessageDocuments` renders them in the transcript.

### Presentation AI Pre-Grading (staff only)

- **Purpose**: before live presentations, staff upload a group's video + slides and the AI drafts a Part I analysis (scorecard, physics error log, items to verify in person) and Part II feedback notes for the TA/professor (Socratic guiding questions, live Q&A questions each with the reason to ask it). Nothing is student-facing; the TA/professor gives the final grade in person.
- **Presenter lookup + record management**: `PresentationGradingJob.presenters` (free text, required in the UI) exists so a TA can find a group's result right after the talk — the list has a debounced search over `presenters`/`topic` (`q` param on `GET /jobs`). Topic/presenters are editable via `PATCH /jobs/[id]`; `DELETE /jobs/[id]` hard-deletes the row plus any remaining temp blobs (confirmed with `AlertDialog` in `JobActions.tsx`).
- **Analytics**: the pages call `useTrackTime("PRESENTATION_GRADING")` (foreground time; `presentation` filter in the admin activity page), and `/api/admin/user-activity` reports `summary.presentationJobCount` from `PresentationGradingJob` rows — deliberately no per-action audit events.
- **Transcript instead of video**: a TA may paste the spoken text directly (`transcript` on `POST /jobs`, ≤`PRESENTATION_TRANSCRIPT_MAX_CHARS` = 8000 chars, exactly one of `audioBlobUrl`/`transcript` required) — the processor then skips transcription entirely.
- **Structured output**: grading uses OpenAI structured outputs (`zodTextFormat(PresentationEvaluationSchema)`), stored as JSON in `summaryJson`; `partIOutput`/`partIIOutput` are legacy markdown fields kept for jobs graded before the switch. The UI (`JobResult.tsx`) renders `StructuredResult` from `parseEvaluation(summaryJson)` and falls back to `LegacyResult` markdown parsing for old jobs.
- **Pipeline**: the browser extracts a 16 kHz mono WAV from the video (`src/lib/extract-audio.ts`, Web Audio — the video never leaves the TA's machine) and uploads audio + slides via `/api/presentation-grading/upload` (staff-only Blob token route). `POST /jobs/[id]/process` (maxDuration 800) transcribes with `gpt-4o-mini-transcribe`, reads slides (PDF passed to the model as a file for vision; PPTX text extracted with jszip), grades with `gpt-5.6-luna` at the job's reasoning effort (`high` default, `xhigh` optional), then **deletes both blobs** — no media is retained. Jobs run independently; the client fire-and-forgets the process call, so closing the tab does not stop a job. Stale in-progress jobs (>15 min) can be taken over; FAILED jobs are retryable while their media still exists.
- **Rubric**: `PresentationRubric` rows are append-only shared versions (seeded from `src/lib/default-presentation-rubric.ts`); each job pins the version it was graded with, so rubric edits never change existing results. The editor has a version-history panel (`GET /rubric/history`, latest 30 versions) — "Load into editor" puts an old version in the draft; restoring is just saving it as a new version.
- **Security**: routes use `requireApiRole(STAFF_ROLES)`; blob downloads only from `*.blob.vercel-storage.com` (`isUploadedBlobUrl`); transcript/slide text is wrapped as untrusted data in the grading prompt; job creation is rate limited via `consumeActionRateLimit` (`presentation_grading_job`, 60/hour).
- **Code**: service `src/lib/services/presentation-grading-service.ts`, shared constants/parsers `src/lib/presentation-grading.ts`, hooks `src/hooks/usePresentationGrading.ts`, UI `src/app/(main)/presentation-grading/` + `src/components/presentation-grading/`.

### Abuse Alerts

`src/lib/abuse-detection.ts` emails active TA/PROFESSOR/ADMIN users plus every address in `ABUSE_ALERT_EMAILS` (comma separated). `trackMessageVolume` fires when a single user exceeds `MESSAGE_VOLUME_ALERT_THRESHOLD` user messages in an hour (default 60); repeat alerts are suppressed by looking for a recent `AuditLog` entry. Student-facing mail is unchanged: only the spam-guard auto-ban notifies the student.

### Assignment Integrity (submissions, files, grading, appeals)

- **Question sync**: `src/lib/services/assignment-service.ts` `syncQuestions()` reconciles `AssignmentQuestion` rows *by id* inside one transaction — editing an assignment no longer deletes and recreates questions (which cascade-deleted student answers, grades and appeals). `QuestionFormData.id` carries the id through `AssignmentForm`. Removing a question that already has answers makes `PATCH /api/assignments/[id]` return 409 with `{ requiresConfirmation, questionsWithAnswers }`; the edit page shows an `AlertDialog` and retries with `confirmDestructive: true`. Question images are revoked only after the transaction commits.
- **Points totals**: `syncQuestions()` writes `Assignment.totalPoints` from the synced questions (and `POST /api/assignments` derives it the same way), so the client's `totalPoints` is ignored whenever questions are sent. Deleting answered questions also recomputes each submission's total from the surviving answers — `totalScore` only when `gradedAt` is set, `draftTotalScore` only when it already existed.
- **MC answer keys**: students submit the option *letter*, so `normalizeAnswerKeys()` (using `src/lib/mc-answer-key.ts`) rewrites an MC `correctAnswer` given as option text or a 1-based number to its letter and rejects anything matching no option with 400. The MC authoring UI ticks accepted options in a checkbox list rather than a free-text field.
- **MC option count**: questions carry between `MIN_MC_OPTIONS` (2) and `MAX_MC_OPTIONS` (8) options with text; the authoring UI adds and removes rows within those bounds, and `normalizeAnswerKeys()` drops blank rows through `compactMcOptions()` (which moves the answer key to the letter it lands on) before rejecting anything outside the range with 400. Never let a blank option reach the database — students would see an empty choice, and the letters would no longer match the key.
- **Student visibility**: `GET /api/assignments/[id]` 404s for students, and the student branch of `GET /api/assignments` filters out, assignments that are unpublished or still waiting on `scheduledPublishAt` — the same rule submit time enforces, so students never get an editable page whose autosave must fail.
- **Submissions**: `src/lib/services/submission-service.ts` owns all submit logic. It rejects unpublished / future-scheduled / deleted assignments for students, FILE_UPLOAD without a file, and resubmission once locked or grading started. Past-due submits return 409 `{ pastDue, dueDate }` until the client sends `acknowledgeLate: true`, then persist `isLate` and `dueDateAtSubmission` — lateness is never recomputed from the current due date. A QUIZ is marked `gradedAt` only when *every* question got an auto score.
- **What "grading started" means**: `humanGradingStarted()` (exported from `submission-service.ts`, shared by `POST /api/submissions` and `PATCH`/`DELETE /api/submissions/[id]`, mirrored by the student's Edit & Resubmit button in `SubmissionView`) is `gradedAt !== null || answers.some(score !== null && !autoGraded)`. Counting auto-graded scores as grading silently blocked resubmission on any quiz with one hand-graded question, which is exactly the case the resubmit rule exists for: a fully auto-graded quiz is released and locked by `gradedAt`, a partly hand-graded one stays editable until a grader touches it. Because an unreleased hand score is masked out of the student payload, `GET /api/assignments/[id]` sends the student an explicit `submission.beingGraded` boolean — without it the client can't see the lock and leaves an Edit & Resubmit button that always 403s.
- **Grade release**: `src/lib/services/grading-service.ts` writes drafts to `Submission.draftTotalScore` and only a finalized save sets `totalScore`/`gradedAt`/`gradedById`. `gradedAt` is the single release gate: `GET /api/assignments/[id]`, `/api/grades` and `/api/assignments` withhold scores, feedback and `correctAnswer` until it is set. Audit actions: `grade_draft_saved`, `grade_finalized`, `grade_ungraded`, `appeal_resolved`, `appeal_rejected`, `assignment_regraded`. `correctAnswer` and `alsoAcceptedAnswers` are both withheld from students until release.
- **Private files**: uploads go through `src/lib/services/file-storage.ts` into `private/uploads` (or Vercel Blob) with an `UploadedFile` metadata row; clients only ever see `/api/files/<id>`, which requires auth and checks uploader/staff access. Nothing new is written to `public/uploads`. Blob is used whenever `BLOB_READ_WRITE_TOKEN` is set; the local-disk branch is a development convenience only, so with `NODE_ENV=production` and no token `storeUploadedFile` throws `FileStorageUnavailableError` and `/api/upload` answers 503 instead of writing to a filesystem the next deploy will wipe. Caveat: `@vercel/blob` v2.2.0 only supports `access: "public"`, so on Blob the underlying URL stays guessable-if-leaked — the blob URL is kept server-side only.
- **Shared limits**: `src/lib/upload-constraints.ts` (20 MB, PDF/PNG/JPEG/GIF/WebP) and `src/lib/answer-limits.ts` (10k chars, 3 images) are imported by both the UI and the API so the accept list can't drift from server validation.
- **Appeals**: `PATCH /api/appeals` validates `newScore` (finite, 0…question points) *before* touching status, so an out-of-range score leaves the appeal `OPEN`. `src/hooks/useAssignmentAppeals.ts` mirrors that client-side and warns when a typed score would be discarded by reject/reopen.
- **Page-level role gating**: `src/components/auth/StaffOnly.tsx` wraps staff pages (`/grading`, `/assignments/create`, `/assignments/[id]/edit`, `/problems/generate`, `/admin/*`) so students get an explicit denial instead of an empty shell. API routes still enforce their own authorization.

### Auto-Grading, Numeric Tolerance & AI Pre-Grades

- **Single grading rule**: `src/lib/auto-grade.ts` `autoGradeAnswer()` is the only deterministic grader. MC compares the normalized option letter case-insensitively; NUMERIC compares numeric *values* (so `9.8`, `9.80`, ` 9.8 ` and `0.98e1` all match) with a small floating-point slack on the boundary; FREE_RESPONSE returns `{ autoGraded: false, score: null }` and always waits for a grader. `submission-service.ts` calls it — do not reimplement comparison logic elsewhere.
- **Per-question tolerance**: `AssignmentQuestion.tolerance` (`Decimal?`) plus `toleranceUnit` (`ToleranceUnit` enum: `ABSOLUTE` | `PERCENT`). `null` means exact equality; `ABSOLUTE` accepts `|given − expected| ≤ tolerance`; `PERCENT` accepts a window of `|expected| × tolerance / 100`, capped at `MAX_TOLERANCE_PERCENT` (100). Significant figures are not enforced. `validateTolerance()` rejects negative/non-finite values and any tolerance on a non-NUMERIC question; `assertValidTolerances()` runs on both create and PATCH, and the authoring UI only shows the controls for NUMERIC questions.
- **Auto-graded scores are editable**: the grading UI labels them "Auto-graded — edit the score to override" and the score input is never disabled. A manual save writes `autoGraded: false` only when the score or feedback actually differs from what is stored (`applyGrades` in `grading-service.ts`), so re-saving an untouched submission keeps the machine-graded badge. Bounds (`0 ≤ score ≤ question.points`) still apply.
- **Opening a submission is read-only**: the grading page hydrates `grades` from the API and immediately calls `useAutoSave`'s `markSaved(initialGrades)`. Without it, hydration looks like an edit, so merely opening a submission autosaved a draft, cleared every `autoGraded` flag and wrote a `grade_draft_saved` audit row.
- **Overall Grade never defaults to 0**: `OverallGradeState.score` is `number | null`; `null`/blank means "no override" and the per-question total is released. `src/lib/grade-release.ts` holds the pure rules — `sumQuestionScores()`, `overrideConfirmAction()` (`clear` | `reject-blank` | `warn-differs` | `confirm`) and `overallGradePayload()` (the only place `overallScore` is added to a save). Confirming a score that differs from the per-question total opens an `AlertDialog` naming both totals; clearing the score also clears the confirmation. Covered by `e2e/grade-release.spec.ts` (no browser or database needed). The localStorage draft schema is `GRADING_STATE_VERSION = 3`: drafts carry their own `submissionId` and `savedAt`, and a draft is discarded when it belongs to another submission or `draftPredatesGrade()` — persisted grades always win, so reopening a finalized submission can never show a zeroed breakdown. That check is why a re-grade and an appeal decision both move `gradedAt` on the submissions they rescore: it is the timestamp of the grade a browser must be newer than, so drafts held in other tabs or on another machine are discarded too.
- **AI pre-grades are suggestions, not scores**: `PUT /api/grading` → `src/lib/services/ai-pregrade-service.ts` stores `aiSuggestedScore` / `aiSuggestedFeedback` / `aiSuggestedAt` on `SubmissionAnswer` and never touches `score`, `feedback`, `totalScore` or `gradedAt`. Suggestions are validated against the question maximum (a Zod schema on the model's JSON) and surfaced as errors rather than silently dropped. The grading page keeps them in a separate `suggestions` map; only the explicit **Apply** button copies one into the editable grade, which still needs a finalize to reach the student. Applying (like typing a score by hand) is picked up by the 5-second grading-draft autosave, so the banner promises only that the student sees nothing until finalize; the draft autosave is disabled once `gradedAt` is set, so a finalized submission's per-answer scores cannot drift away from its released total without an explicit Unfinalize. The provider comes from the active `AIConfig` — the same configuration chat uses; there is no separate generator/grader provider setting.
- **Generated answer keys**: `buildProblemPrompt()` requires MC answers as a bare option letter and NUMERIC answers as one plain finite number (no units/LaTeX), and `POST /api/problems/generate` (Zod-validated) normalizes what comes back through `normalizeMcAnswerKey()` / a numeric extraction, so generated questions grade correctly on import.
- **Generated problems are not gradeable as-is** — `src/lib/generated-problem.ts` closes the gap, and anything turning a `GeneratedProblem` into an `AssignmentQuestion` must use it. (a) `generatedTolerance(questionType)` gives NUMERIC questions `GENERATED_NUMERIC_TOLERANCE_PERCENT` (1%, `PERCENT`) — the generate → assignment payload sends no tolerance otherwise, and exact-match scored a correctly rounded `0.83` as 0 against a generated `0.834` key. (b) `stripOptionLabels()` drops the `"A. "` the model writes into the option text itself, which the UI renders behind its own letter as `A. A. 0.50 A`; it only removes a label matching the option's own position, and runs both when a set is generated and when the bank is read, so older sets are cleaned too. (c) `problemPreview()` is the staging list's one-line plain text (markdown stripped, math collapsed to `…`) — the row is `line-clamp-1`, so the full renderer is not an option there. Covered by `e2e/generated-problem.spec.ts` (no browser, no LLM).
- **The generated MC letter is the least trustworthy field the model writes** — solutions deriving option B have repeatedly ended "corresponds to Option C", and the wrong key then grades cleanly and marks correct students down. So the prompt also asks for `correctAnswerValue` (a verbatim copy of the correct option's text) and `mcKeyFromValue()` resolves the key from that value, falling back to the stated letter only when the value matches no option or matches ambiguously. Comparison ignores LaTeX wrappers and whitespace. This does not make a key *correct* — the model's answer *value* is wrong often enough on its own (measured 4 of 9 generated MC problems in one run) — so `keyContradictsSolution()` additionally flags a problem whose key value appears nowhere in its own solution, shown as an amber "Check key" badge on the staging row and a warning on the generated card, and creating an assignment still warns the author (`VERIFY_KEYS_NOTICE`) to read every key before publishing. The numeric match there is deliberately tight (0.5%): distractors sit within 1% of the derived value. Detection is advisory; the gate below is what actually stops an unread key reaching students.
- **An assignment built from generated problems cannot be published until every answer key is confirmed by hand** — `Assignment.requiresKeyReview` (set only by the generate → assignment payload; the PATCH schema cannot change it) makes each `AssignmentQuestion` carry `keyConfirmedAt` / `keyConfirmedById`. Staff confirm one question at a time via `POST /api/assignments/[id]/questions/[questionId]/confirm-key` → `setAnswerKeyConfirmed()` in `src/lib/services/key-review-service.ts`, which refuses assignments not under review, holds TAs to their own assignments, and audits `answer_key_confirmed` / `answer_key_unconfirmed`. Every publish path is gated: `PATCH /api/assignments/[id]` calls `assertAnswerKeysConfirmed()` (409 plus `unconfirmedQuestionNumbers`, so a direct API call cannot skip the UI), scheduling is refused at create time, and the shared `publishAssignment()` in `email-service.ts` only matches `requiresKeyReview: false` or `questions: { none: { keyConfirmedAt: null } }`, so the cron that runs a schedule cannot publish an unreviewed key either. `syncQuestions()` clears a confirmation whenever an edit changes `correctAnswer`, `alsoAcceptedAnswers`, MC `options` or a numeric `tolerance` (`answerKeyChanged()` in `src/lib/key-review.ts`) — question wording is not part of the key. Staff review in `KeyReviewSection.tsx` on the assignment page (question text, options, key, tolerance, who confirmed and when); manually authored assignments never show it and publish as before. Covered by `e2e/key-review.spec.ts`.
- **Grading ergonomics**: `Enter` in a score box confirms that question and focuses the next one (`data-score-input={index}` in `GradingPanel.tsx`), `Alt+F` fills the question maximum, and **Save & next** (`handleSaveGrades(true)`, also `Ctrl/⌘+Enter`) advances to the next submission in the *filtered* queue only after the save succeeds — it reuses the same finalize confirmation, autosave flush and localStorage cleanup as **Finalize**, so nothing bypasses the release gates. The save handler patches `submissions`/`selectedSubmission` before advancing and only when the panel still shows the saved submission id, and the localStorage writer is gated on `hydratedSubmissionIdRef`, so the next submission never renders or persists the previous one's scores. Submission-level keys live in `src/hooks/useGradingShortcuts.ts` (ignored while a text field has focus) and are documented in `GradingShortcutsDialog` — keep that list in sync when adding a key.
- **Grading header wraps on narrow screens**: the panel header's action row is `flex flex-wrap justify-end`, so By Question / Shortcuts / Finalize / Save & next stay reachable at 375px instead of overflowing the viewport.
- **Reference answers are staff-only**: `GET /api/assignments/[id]/submissions` (TA/PROFESSOR/ADMIN only) returns `referenceAnswer` per answer from `AssignmentQuestion.correctAnswer`, and `GradingPanel` renders it collapsed behind a Show/Hide toggle. Never add `correctAnswer` to a student-facing response.
- **More than one accepted answer**: `AssignmentQuestion.alsoAcceptedAnswers` (`String[]`, default `[]`) holds the extra keys that also score full marks, with `correctAnswer` staying the canonical one (LaTeX export and staff display read it). `acceptedAnswers()` in `auto-grade.ts` is the whole difference: MC matches the submitted letter against the set, NUMERIC applies the question's tolerance to every accepted value. Students still answer with a single choice. For MC, `normalizeAnswerKeys()` rejects with 400 any extra key that matches no option *or* points at a blank row, so widening a key can never silently score the class against an option nobody saw; `compactMcOptions()` moves canonical and extra keys together when blank rows are dropped, and `keysAfterOptionRemoval()` does the same for a single deletion in the authoring UI — deleting a row must shift keys relative to the list *still in state* (blank rows included), since compacting instead would point a key at whatever option the author can see in that slot; the deleted option's own key comes back empty rather than landing on a neighbour.
- **Re-running auto-grading**: `POST /api/assignments/[id]/regrade` (TA/PROFESSOR/ADMIN) → `src/lib/services/regrade-service.ts` re-scores submitted answers against the current keys, for when a key was wrong or a second option was opened up afterwards. Only answers still flagged `autoGraded` *and* free of a `RESOLVED` appeal are touched (`hasResolvedAppeal` on `AnswerToRegrade`), so a grader's score, feedback and appeal outcome survive — an appeal that granted marks on a machine-graded answer must not be undone by the next re-grade, which is also why `POST /api/appeals` writes `autoGraded: false` alongside the new score. A TA may only re-grade an assignment they created (`actor: { id, role }`, 403 otherwise; professors and admins are unrestricted), matching `key-review-service.ts`. A released submission (`gradedAt` set) keeps its release and its total moves by the *delta* of the changed answers (`totalAfterRescores(answers, rescores, storedTotal)`), so an overall grade a grader typed by hand keeps its offset instead of being replaced by the bare per-question sum; an unreleased one only updates `draftTotalScore` — re-grading never publishes grades, and never turns a partly graded submission into a released one. Each submission is updated in one transaction and writes an `assignment_regraded` audit row (previous and new total, released flag, changed answer count). `plannedRescores()` / `totalAfterRescores()` are pure and hold the rules. `RegradeButton` (`src/components/grading/`) shows the affected count in an `AlertDialog` before running and reports the result in a toast.
- **Authoring accepted answers**: `McAnswerKey` (`src/components/assignments/`) is the MC answer key — a checkbox per non-blank option, first accepted letter stored as `correctAnswer`. Emptying an option hides its checkbox, so any key left pointing at it is called out immediately in an amber warning with a **Drop it** action, instead of only failing on save. Changing a question's type runs `applyQuestionEdit()`, which clears `correctAnswer`, `alsoAcceptedAnswers` and `tolerance` — MC letters are meaningless as numeric values (and the reverse), and a stale extra key would keep scoring after the switch. `NumericAnswerFields` does the same job for NUMERIC: canonical value plus up to 8 extra accepted values (blank rows are dropped server-side by `dedupeExtraAnswers()` before the numeric check, so an empty row never becomes `0`), all sharing the question's tolerance and unit.
- **Handwritten answers in a quiz**: every quiz question can carry up to 3 attachments (`SubmissionAnswer.answerImageUrls`) — photos *or* a PDF of scanned work — via `ImageUpload allowPdf` (5 MB per image, `MAX_UPLOAD_BYTES` for a PDF). `FILE_UPLOAD` assignments are unchanged. A PDF must never reach an `<img>`: `AttachmentThumbnails` (`src/components/ui/`) renders it as a file tile linking to the file, and is the shared renderer for the student view and `GradingPanel`. `isPdfUrl()` reads the extension from the URL path *or* the `?name=` the `/api/files/<id>` URL carries (`fileUrl(id, filename)`), since the route path has no extension; an image that fails to load falls back to the tile, which covers attachments stored before `?name=` existed. `ai-pregrade-service.ts` filters PDFs out before building image parts, so a PDF attachment cannot break a suggestion.
- **A quiz draft is answers *and* attachments**: `useAssignmentDetail` autosaves a `QuizDraft` (`{ answers, images }`), so attaching a photo without typing anything still saves — watching `answers` alone lost an attachment-only change on reload. `markSaved()` therefore has to be given both halves when a draft is restored, or hydration looks like an edit. A question is included in the draft when it has text *or* attachments, and an *empty* quiz is still posted once a draft exists (`savedDraftRef`) — returning early there let the stale server draft resurrect the attachment the student had just removed.
- **Whose file is whose**: `Submission.fileUrl` is the *student's* upload (`FILE_UPLOAD` assignments) and nothing on the grading side may write it. A grader's feedback attachment goes to `Submission.feedbackFileUrl` (`POST /api/grading` `feedbackFileUrl` → that column) and is shown to the student only once the submission is released. Writing feedback into `fileUrl` used to destroy the student's own upload.
- **Grading page composition**: `src/app/(main)/grading/page.tsx` stays under 400 lines (Rule 1.1) by owning only the filter, layout and wiring. The queue (assignment list, pagination, submissions, counters) is `src/hooks/useGradingQueue.ts`; everything about the open submission (grades, AI suggestions, confirmations, overall grade, drafts, autosave, finalize/unfinalize, save & next) is `src/hooks/useSubmissionGrading.ts`. Presentation is `AssignmentPicker`, `SubmissionToolbar`, `SubmissionList`, `GradingPanelHeader`, `GradingPanelStatus`, `GradingPanel`, `OverallGradeForm`, `AppealThread` and `GradingDialogs` (every `AlertDialog` in one place). Add grading behaviour to a hook or one of those components, never back into the page. Anything that changes scores server-side (re-grade, an appeal decision) goes through the page's `reloadAfterScoreChange`, which drops the stored drafts of every listed submission (`discardDraft`) and clears the open one before reloading the queue: both hold `grades` hydrated from the old scores, and finalizing either would write them straight back over the corrected ones. Closing the panel alone was not enough — the `grading-state-<submissionId>` draft survived, so reopening the submission restored the pre-re-grade scores. (`useGradingQueue` still loads with `useEffect` + `fetch` rather than React Query — Rule 1.2 — because TanStack Query is not a dependency of this project yet.)
- **Draft totals in the queue**: `GET /api/assignments/[id]/submissions` (staff-only) returns `draftTotalScore` alongside `totalScore`, and `SubmissionList` shows it as `<draft>/<totalPoints>` with a `Draft · not released` badge when `totalScore === null` — showing `0/30 · Ungraded` for a submission a grader had already scored made graders redo the work. Released rows keep the green graded badge, genuinely untouched rows keep `Ungraded`. Never let `draftTotalScore` reach a student payload: `GET /api/assignments/[id]` spreads the submission record, so it nulls `draftTotalScore` next to `totalScore` (a student could otherwise read their in-progress grade straight out of the network response even though nothing renders it), and an unreleased score must read as `Not graded yet` / `Pending`.
- **Tests**: `e2e/regrade.spec.ts` covers widened keys raising a score, corrected keys lowering one, hand-edited scores and resolved appeals being skipped, deleted questions, totals that keep untouched scores and a hand-typed overall grade's offset, and `draftPredatesGrade()` deciding which stored drafts survive a score change. `e2e/mc-options.spec.ts` covers blank-row compaction, single-option deletion and the answer-key reset on a question-type change. `e2e/auto-grade.spec.ts` covers exact equality, whitespace, trailing zeros, exponent form, absolute/percent boundaries, values just outside, MC case handling, free-response exclusion and tolerance validation. `e2e/attachments.spec.ts` covers `isPdfUrl()` across blob URLs, `/api/files/<id>?name=` and pre-`?name=` URLs. `e2e/feedback-file.spec.ts` pins `gradeSaveUpdate()` to writing `feedbackFileUrl` and never `fileUrl`. None of them need a browser or database.

### Concurrency (autosave races, connection pool)

- **One live submission per student**: `saveSubmission()` runs every read-then-write path inside `withSubmissionLock()`, a `prisma.$transaction` that takes `pg_advisory_xact_lock(4271, hashtext("<assignmentId>:<userId>"))` first. The lock is held by Postgres, so it serializes saves across tabs *and* across server instances; concurrent autosaves would otherwise each read "no submission" and each create one. The transaction also covers deleting the previous final submission on resubmit; replaced upload URLs are collected and deleted only after it commits.
- `migrations/20260814110000_one_live_submission_per_student` de-duplicates existing rows (keeping the newest non-draft per student) and adds a partial unique index `Submission(assignmentId, userId) WHERE isDeleted = false`, so a duplicate can never be created even if a code path skips the lock. Soft-deleted rows stay outside the index, which is what resubmission relies on.
- `existing`-submission lookups filter `isDeleted: false` so a soft-deleted submission no longer blocks a new one.
- **Pool size**: `src/lib/prisma.ts` sizes the `pg` pool from `DATABASE_POOL_MAX` (default 25) with a 10s `connectionTimeoutMillis`. Keep `instances × DATABASE_POOL_MAX` under the database's `max_connections`.
- **Load testing** (disposable database only — never point these at a real one):
  ```bash
  DATABASE_URL=<disposable> LOAD_PASSWORD=<throwaway> npx tsx scripts/seed-load-test.ts   # 200 students + a published quiz
  BASE_URL=http://localhost:3100 LOAD_PASSWORD=<throwaway> npx tsx scripts/load-test.ts   # 200 students: page, GET, 5 drafts, submit
  BASE_URL=http://localhost:3100 LOAD_PASSWORD=<throwaway> RACE_PARALLEL=8 \
    npx tsx scripts/race-test.ts <assignmentId> <questionId,...> [email]                  # same-student autosave race
  ```
  These log in through real NextAuth credentials (no E2E bypass), so run them against a production-mode build. `LOAD_PASSWORD` has no default on purpose. Coverage stops at assignment page/API, drafts and submit — chat SSE and file uploads are not exercised.
- `e2e/concurrent-autosave.spec.ts` is the regression test: parallel drafts and parallel finals must leave exactly one submission with a full set of answers.

### Prisma Migrations

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name <migration_name>

# Regenerate Prisma client
npx prisma generate
```

## UI Development Rules 
Always verify changes visually using Playwright browser screenshots before claiming a UI fix is complete. Never say a UI change is done without taking a screenshot to confirm.

## Build & Deploy
This is a TypeScript project. Always run `npx tsc --noEmit` or the project's type-check command after making changes to catch build errors before committing. Vercel deployments will fail on type errors.

## Git Workflow
When creating PRs, always create a NEW branch from main. Never commit to an already-merged PR branch. Ask the user to confirm the target branch if ambiguous.

## UI Development Rules
For mobile CSS fixes, test at viewport widths 375px and 768px using Playwright. Mobile layout issues (sidebar overlap, keyboard behavior, spacing) often require 2-3 attempts — take screenshots at each iteration before moving on.

## Known Limitations
When working with images or screenshots, keep dimensions under 2000px to avoid API limits. When batch-processing images, process them one at a time rather than in bulk to avoid size limit errors.

## Build & Deploy
After Vercel deployment, always verify the build succeeded by checking the deployment URL. Common issues: prisma generate not running (add to build command), .next cache stale on localhost (delete it), and CJS/ESM incompatibilities with packages like react-katex.

## Recommended Agent Skills

Use the following skills when working on relevant areas of the codebase. Install with `npx skills add <source> -g -y`.

| Skill | Install | Purpose |
|-------|---------|---------|
| `vercel-react-best-practices` | `npx skills add vercel-labs/agent-skills@vercel-react-best-practices -g -y` | React & Next.js best practices from Vercel Engineering |
| `nextjs-app-router-patterns` | `npx skills add wshobson/agents@nextjs-app-router-patterns -g -y` | Next.js App Router architecture patterns |
| `tailwind-v4-shadcn` | `npx skills add jezweb/claude-skills@tailwind-v4-shadcn -g -y` | Tailwind CSS + shadcn/ui component patterns |
| `typescript-advanced-types` | `npx skills add wshobson/agents@typescript-advanced-types -g -y` | Advanced TypeScript type patterns |
| `prisma-expert` | `npx skills add sickn33/antigravity-awesome-skills@prisma-expert -g -y` | Prisma ORM best practices |
| `prisma-client-api` | `npx skills add prisma/skills@prisma-client-api -g -y` | Official Prisma Client API reference |
| `playwright-skill` | `npx skills add sickn33/antigravity-awesome-skills@playwright-skill -g -y` | Playwright E2E testing patterns |