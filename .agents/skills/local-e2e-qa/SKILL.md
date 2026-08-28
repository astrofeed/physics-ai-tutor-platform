---
name: local-e2e-qa
description: Recipe for running browser-driven end-to-end QA of this platform on a local scratch database, including identity switching, local file uploads, quiz autosave/draft behaviour, grading-page checks, and teardown. Use when verifying a PR's runtime behaviour in the browser rather than via unit tests.
---

# Local end-to-end QA recipe

## Box facts (re-confirmed across many sessions)

- Host has **no `psql`** — run Postgres commands inside the container:
  `docker exec physics-ai-tutor-platform-db-1 psql -U postgres -d <db> -c "..."`
- Host has **no `lsof`** — use `ss -ltn | grep <port>` and `pkill -f "next dev"` / `pkill -f "next-server"`.
- A still-running dev server keeps DB sessions open, so `DROP DATABASE` fails with
  "N other sessions are using the database". **Stop the server before dropping.**
- Use `prisma migrate deploy` on the scratch DB. Never `prisma db push` (AGENTS.md Rule 3.1).
  Fresh scratch DBs have applied cleanly for many consecutive migrations.
- Maximize the browser before recording with
  `DISPLAY=:0 wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`
  (do NOT use `xdotool key super+Up`, which half-tiles).

## Standard setup

```bash
DB=ptp_prXX
docker exec physics-ai-tutor-platform-db-1 psql -U postgres -d postgres -c "CREATE DATABASE $DB;"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/$DB"
npx prisma migrate deploy
npx tsx e2e/seed-test-data.ts     # seeds test-student@e2e.local / test-ta@e2e.local
```

Start the server with a per-PR port and uploads forced to local disk:

```bash
E2E_TEST_MODE=true E2E_TEST_SECRET=e2e-secret \
PRIVATE_UPLOADS_DIR=/home/ubuntu/prXX-uploads PORT=3900 npm run dev
```

`BLOB_READ_WRITE_TOKEN` must be **unset**, otherwise uploads go to Vercel Blob. Uploaded files are
always served through `/api/files/<id>?name=<filename>`, which authorizes every read.

## Identity switching

`E2E_TEST_MODE=true` bypasses NextAuth and reads the **`e2e-test-user-email` cookie**. Switch users
from the browser console (the one legitimate console use — it is setup, not a UI action):

```js
document.cookie = 'e2e-test-user-email=test-ta@e2e.local; path=/; max-age=86400';
```

Then reload. Seed extra users/assignments with a throwaway `prXX-seed.ts` at the repo root run via
`npx tsx`; delete it during teardown.

Prisma gotchas when writing seeds: the assignment flag is `lockAfterSubmit` (not `allowResubmit`),
the question field is `questionType` (not `type`), and the multiple-choice enum value is `MC`
(not `MULTIPLE_CHOICE`). Under Prisma 7 a bare `new PrismaClient()` throws
`PrismaClientInitializationError` — construct it with the pg adapter:
`new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })`
(import `PrismaPg` from `@prisma/adapter-pg`).

## Quiz autosave / draft behaviour

- `useAssignmentDetail` autosaves a `{ answers, images }` draft object through `useAutoSave`
  with a **2 s debounce**; `useAutoSave` resets `saved → idle` after **3 s**, so a screenshot of
  `Saved at HH:MM` must be taken inside that window.
- `saveDraft` only returns early when no question has text or attachments **and no draft exists yet**
  (`savedDraftRef`). Once a draft has been saved, clearing everything POSTs `answers: []`, which wipes
  the server rows, so removing the *last* remaining attachment persists across a reload (verified at
  `ff71e26`). If a removal ever fails to persist, check that guard and whether `savedDraftRef` was set
  on draft restore.
- A draft POST **deletes and recreates all answer rows**, so removals genuinely persist — verify by
  querying `SubmissionAnswer`, not by trusting the indicator.
- **Never trust the save indicator alone.** It can display a stale `Saved at HH:MM` even when no
  `POST /api/submissions` happened. Corroborate with the dev-server log and the DB.
- Draft restore shows `Your previous answers were restored from an auto-saved draft.` and calls
  `markSaved({answers, images})`; a restored draft must NOT trigger an immediate save.
- Grading-page draft restore banner is different: `Grading progress restored from a previous session.`
  Force it by reloading inside the 5 s grading autosave window, and clear `grading-state-*` in
  localStorage when you want to test **server** hydration rather than the local draft.
- Grading drafts are invalidated two ways (since `2806c5c`): the grading page calls `discardDraft(id)`
  for every queued submission after a re-grade / appeal score change, and `draftPredatesGrade(savedAt,
  gradedAt)` drops any draft saved at or before the server `gradedAt` on load. Re-grade and appeal
  resolution both bump `Submission.gradedAt`, which is what kills drafts held in *another* tab or
  browser context. When testing this, assert on the reopened panel's per-question values and the
  absence of the restore banner — that is the user-visible property — and corroborate with
  `select "totalScore","gradedAt" from "Submission"`.
- **Cross-context tests: the `browser_console` tool attaches to the foreground Chrome window.** After
  opening a second window (e.g. incognito via `ctrl+shift+n`), a `localStorage` read returns *that*
  window's storage, which silently looks empty. Close or refocus the original window before reading
  storage, and sanity-check with `location.href` plus a DOM probe. An incognito window is also a
  separate session: re-set the `e2e-test-user-email` cookie there.

## Known structural limits when planning tests

- **FILE_UPLOAD submissions cannot exercise the grading draft path**: `saveGradingDraft` returns
  early with no per-question grades. Use a QUIZ assignment for autosave/draft tests. Also note
  `unfinalizeSubmission` copies `totalScore → draftTotalScore` on its own, which is easy to misread
  as a successful draft save.
- **Resubmission lock classification** lives in `humanGradingStarted()` (`submission-service.ts`):
  `gradedAt !== null || answers.some(a => a.score !== null && !a.autoGraded)`. So a *mixed* quiz
  (FREE_RESPONSE + auto-graded MC/NUMERIC, `lockAfterSubmit=false`) stays editable after submit
  (PATCH 200), a TA-confirmed hand score locks it with `This submission is being graded and cannot be
  edited.` (403 + sonner toast), and a fully auto-graded quiz is released at submit (`gradedAt` set,
  `totalScore` summed) so it shows `This submission has been graded. You cannot edit or resubmit.`
  and no edit control at all. Note the student API masks unreleased scores, so the *client* gate
  cannot see a hand-saved score — the lock must be proven by the PATCH 403 + toast, screenshotted
  within ~2 s of clicking Continue.
- Only `MC | NUMERIC | FREE_RESPONSE` exist in `QuestionType`; there is no SHORT_ANSWER/ESSAY, so
  FREE_RESPONSE is the hand-graded type to use in mixed-grading fixtures.
- On the grading page, a per-question hand score persists to `SubmissionAnswer.score`
  (`autoGraded=false`) as soon as you click the ✓ **Confirm score** button next to the input — no
  Finalize needed, and `gradedAt` stays null (unreleased).
- Feedback-file tests must assert `Submission.fileUrl` is **unchanged** *and* `feedbackFileUrl` is
  populated — they are separate columns. Use two visually distinct PDFs so a swap is visible rather
  than inferred from URLs.
- Attachments render via shared `AttachmentThumbnails`: images as `<img>` thumbnails, PDFs as a
  bordered tile reading `PDF` wrapped in an `<a>`. A PDF inside an `<img>` is a bug.

## AI problem generation (`/problems/generate`)

- Staff-only (`StaffOnly` wrapper) — switch to `test-ta@e2e.local` first. Start the dev server with
  real keys bound from org secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`); with no active `AIConfig`
  row in a fresh scratch DB the route defaults to **openai** (`gpt-5.2`, `src/lib/ai.ts`).
- Generation is SSE: a `<pre>` shows the raw JSON growing, then a `done` event replaces it with cards.
  A full MC set of 3 takes ~40 s. Do **not** smoke-test with `curl ... | head -c N` — truncating the
  client stream aborts the request before the server persists the `ProblemSet`, so the DB stays empty
  even though the log shows `POST /api/problems/generate 200`.
- Generating a new set **clears** `pastSets` in state; the persisted sets still show under
  **Problem Bank** (collapsed by default — click it to expand). Tick 2+ set checkboxes to reveal
  `Merge Selected`, which populates the **Staging Area**.
- Staging reorder is dnd-kit: drag the left grip handle. Use `mouse_move` → `left_mouse_down` →
  several `mouse_move` steps → `left_mouse_up` (`left_mouse_down` takes no coordinate).
- Staging `Create Assignment` POSTs `/api/assignments` and redirects to `/assignments/<id>/edit`;
  it sends questionText/type/options/correctAnswer/points/diagram only.
- `GeneratedProblem` has no tolerance column. Since `adac97a` both create-assignment payloads spread
  `generatedTolerance()` from `src/lib/generated-problem.ts`, so generated NUMERIC assignment
  questions land with `tolerance = 1` / `toleranceUnit = PERCENT` (verified for both the merged-staging
  button and the single-set button in the `Generated Problems (N)` card header). Older commits stored
  `NULL`/`ABSOLUTE` → exact-match grading. Always corroborate in `AssignmentQuestion`, and test a
  rounded answer (inside 1%) plus an off-by->1% answer downstream.
- There are **two** `Create Assignment` buttons: one in the `Generated Problems (N)` card header
  (single-set, `createAssignmentFromProblems`) and one in the Staging Area (`createAssignmentFromMerged`).
  They are separate code paths — prove whichever one the change touches, and keep the staging area
  closed when testing the single-set one.
- Since `cf2c4dc` the MC key is resolved from the model's `correctAnswerValue` via
  `mcKeyFromValue(value, options)`; the stated letter is only a fallback. `correctAnswerValue` is
  **not persisted**, so to tell a mapping bug from a model content error you must capture the raw
  streamed JSON *before* generating — the `<pre>` is replaced by cards when the stream finishes:
  ```js
  window.__cap=''; window.__capTimer=setInterval(()=>{const p=document.querySelector('pre');
    if(p&&p.textContent.length>window.__cap.length) window.__cap=p.textContent;},700);
  ```
  A fast direct check of the mapping is `npx tsx` importing `mcKeyFromValue` with the exact persisted
  `options` array from the DB — if the correct value maps to the right letter, a wrong stored key means
  the model's own value/solution disagreed, not our mapping.
- To prove the value-over-letter override deterministically, add custom instructions telling the model
  to state a deliberately wrong `correctAnswer` letter while keeping `correctAnswerValue` verbatim;
  the persisted key should still be the value's option.
- Nothing validates the key against the problem's worked solution, and models still emit
  `correctAnswerValue`s that contradict their own solutions (or pick a "closest option" when their
  computed result is not among the options). Expect a nonzero wrong-key rate; read every solution and
  compare rather than assuming the key is right.
- Generated MC options are stripped of self-labels on write and on bank read (`stripOptionLabels`), so
  `A. A. 0.50 A` should no longer appear; a regression here is student-visible.

## Upload & drag/drop testing gotchas

- Seeded e2e users have `emailVerified` NULL, so chat-attachment uploads return 403 until you run
  `UPDATE "User" SET "emailVerified" = NOW();` in the scratch DB.
- Synthetic drag/drop must be dispatched on an element *inside* the chat column div (e.g. the
  message textarea), not on `<main>` — the drop handlers live on the chat column.

## Teardown

```bash
pkill -f "next dev"; pkill -f "next-server"; sleep 4
ss -ltn | grep 3900 || echo PORT_CLOSED
docker exec physics-ai-tutor-platform-db-1 psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DB;"
rm -rf /home/ubuntu/prXX-uploads /home/ubuntu/prXX-files prXX-seed.ts
git status --porcelain   # must be empty
```

## Devin Secrets Needed

None for local QA. A Google client secret would be required only to exercise the real OAuth
callback; Vercel log access would be required to confirm production email/notification recipients.
