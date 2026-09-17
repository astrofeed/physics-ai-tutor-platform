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

In a git worktree whose `node_modules` is a symlink to the main checkout, Turbopack fails with
"Next.js package not found" — start with `npx next dev -p <port>` (webpack) instead of `npm run dev`,
and run `npx prisma generate` in the worktree first so the shared client matches its schema.

`BLOB_READ_WRITE_TOKEN` must be **unset**, otherwise uploads go to Vercel Blob. Uploaded files are
always served through `/api/files/<id>?name=<filename>`, which authorizes every read.

Chat attachments (`/api/upload/client`) and presentation-grading slide uploads have **no** local
fallback — they are Blob client uploads. Two things follow:

- With the token unset, `@vercel/blob`'s `handleUpload` throws "No token found" **before** it calls
  `onBeforeGenerateToken`, so the route's own file-type / size / quota checks never run. To exercise
  those checks without a real store, start the server with a syntactically valid dummy token such as
  `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_E2EDUMMYSTORE_e2edummysecret0000000000` — token generation
  is a local HMAC (no network), so accepted files get a 200 + client token and rejected ones get the
  route's 400 message. The subsequent browser PUT to Blob will fail, which is fine for classification
  tests. Probe the route from the page (same-origin, e2e cookie) by POSTing
  `{type:'blob.generate-client-token', payload:{pathname, callbackUrl, multipart:false, clientPayload:JSON.stringify({filename, contentType, sizeBytes})}}`.
- To get a sent message with an attachment all the way into the transcript, temporarily replace the
  `upload()` call in `src/hooks/use-chat-attachments.ts` with a fake `https://…blob.vercel-storage.com/<name>`
  URL (revert afterwards and disclose it). Server-side text extraction of that URL will fail with a
  404 — evidence extraction separately with a `npx tsx` script against `src/lib/services/*-extraction.ts`.

Real drag/drop onto the chat needs `File` objects with real bytes: serve the fixture dir with a tiny
CORS-enabled `python3 -m http.server`-style script on another port, `fetch()` the bytes in the page,
build `new File([blob], name, {type})`, and dispatch `dragenter`/`dragover`/`drop` `DragEvent`s with a
`DataTransfer` on an element *inside* the chat column (e.g. the message textarea). Always dispatch
`dragleave` or `drop` afterwards, otherwise the overlay stays up. Chrome's minimum window width is
~530px, so 375px checks need DevTools device mode (F12 → Ctrl+Shift+M, type 375 in the width box).

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

## Proving what the model receives (no real key): mock OpenAI

The openai-node SDK honours `OPENAI_BASE_URL`, so the whole chat path can run against a local mock
and every outbound request body can be inspected (needed to verify prompt/attachment construction
such as `input_file` / `input_image` / `<document>` blocks — the DB only stores plain text).

- Run a tiny HTTP server on `127.0.0.1:<port>` that accepts `POST /v1/responses`, saves the JSON
  body to a file, and replies:
  - `stream: true` → SSE with `event:`/`data:` lines: `response.created`, N×
    `response.output_text.delta` (`{"type","delta","item_id","output_index","content_index"}`),
    then `response.completed`. The chat route only consumes `response.output_text.delta`,
    `response.reasoning_summary_text.delta` and `response.output_text.annotation.added`.
  - `stream` absent (title generation, summaries) → JSON with `output_text` and an
    `output[].content[].text` message.
- Start the app with `env -u DEEPSEEK_API_KEY -u GP2_OPENAI_API_KEY OPENAI_API_KEY=sk-dummy
  OPENAI_BASE_URL=http://127.0.0.1:<port>/v1 …`. The session environment exports real provider
  keys — if `DEEPSEEK_API_KEY` is set, chat silently routes to DeepSeek (hard-coded base URL, not
  mockable) and the mock never sees a request.
- Document attachments are fetched server-side and must pass `isUploadedBlobUrl` (https
  `*.blob.vercel-storage.com`). To exercise real extraction without Blob: serve fixtures from a
  local CORS server, stub `upload()` in `use-chat-attachments.ts` to return
  `http://127.0.0.1:<fixture-port>/<name>`, and temporarily let `isUploadedBlobUrl` accept that
  origin. Mark both edits `E2E-TEST-STUB` and `git checkout` them at teardown.
- Trim base64 before reporting (`data:application/pdf;base64,` payloads are ~23k chars for a 17 KB
  PDF); a regex on `(data:[^;]+;base64,)([A-Za-z0-9+/=]{40})[A-Za-z0-9+/=]*` works.
- pdfjs logs `Warning: UnknownErrorException: Ensure that the standardFontDataUrl API parameter is
  provided.` on every PDF extraction; it is benign (extraction still succeeds).

## Presentation grading: video → audio in the browser (ffmpeg.wasm fallback)

`extractAudioFromVideo` tries Web Audio `decodeAudioData` first and falls back to ffmpeg.wasm for
containers Chrome can't decode (WMV/AVI/MKV). The mock/stub recipe above extends to it:

- The mock OpenAI server must also answer `POST /v1/audio/transcriptions` (multipart; save the
  `file` part — it is the WAV the server re-downloaded from Blob — and return `{"text": …}`) and a
  non-streaming `/v1/responses` whose `output_text` is a JSON string matching
  `PresentationEvaluationSchema` (`scorecard[]`, `questions[]`, …); then jobs reach DONE locally.
- Blob stand-in for `uploadToBlob` in `usePresentationGrading.ts`: a tiny CORS server that accepts
  `PUT /<filename>` and returns `{"url": "http://127.0.0.1:<port>/<saved-name>"}`; also whitelist
  that origin in `isUploadedBlobUrl`. Mark both `E2E-TEST-STUB` and `git checkout` them at teardown
  (check `git status` first — only revert your own files if the lead has concurrent edits).
- Fixtures via ffmpeg lavfi: `-f lavfi -i "sine=…"` (or espeak → wav) + `-c:v wmv2 -c:a wmav2`
  for WMV, `-c:v mpeg4 -c:a libmp3lame` for AVI, `-an` for a silent file, `-t 230` for one that
  breaks the 3:30 limit. A ~14 s clip transcodes in ~1 s, so the phase labels flash by: install a
  `MutationObserver` on the submit button's text into `window.__phaseLog` to prove the order
  (`Extracting… → Converting the video with ffmpeg… → Uploading… → Starting…`).
- Network proof: a CDP `Network` listener on the existing Chrome catches the one-time
  `unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.{js,wasm}` GETs (loaded via `toBlobURL`,
  so only 2 requests ever; a second fallback file in the same page session must add none) and the
  stub PUTs. Uploaded WAV should be `pcm_s16le` mono 16 kHz ≈ 32 000 B/s (`ffprobe -show_entries
  stream=codec_name,sample_rate,channels:format=duration`).
- The dev server logs `LOAD FAILED net::ERR_ABORTED <id> type=Fetch` bursts right after a job
  completes — React Query refetch aborts, unrelated to ffmpeg/worker loading.
- Native GTK file chooser: `Ctrl+L`, type the absolute path, Enter. The slides picker filters to
  `.pdf,.pptx,…` so only matching files are listed.

## Presentation grading: eeClass ZIP import + Google Sheets sign-up roster

- The roster needs the `PresentationRoster*` migration: `nvm use 22.23.2 && npx prisma generate &&
  npx prisma migrate deploy` on the scratch DB, otherwise `/api/presentation-grading/roster` 500s
  (`Cannot read properties of undefined (reading 'findFirst')`).
- `GET /api/presentation-grading/roster` auto-imports the real course sheet
  (`DEFAULT_ROSTER_SHEET_URL`, docs.google.com — network needed) the first time staff open the
  grade tab. To retest the "empty roster" path, `delete from "PresentationRoster"` and reload; to
  get a stable expected count, export the sheet as CSV yourself and count distinct 9-digit IDs
  (the number drifts as students sign up — don't trust a count quoted in the task).
- ZIP parsing is client-side (jszip); the archive itself is never uploaded — assert on the Blob
  stand-in that only `presentation-audio.wav` / slides PUTs appear. `ArchiveDropZone` is a
  `<button>` wrapping a hidden `<input multiple accept=".zip">`: click it, then `Ctrl+L` in the GTK
  chooser; multi-select by typing `"/path/a.zip" "/path/b.zip"` in the location bar. The input is
  reset after each pick, so re-picking the same file must fire again (regression to keep).
- Multi-student fixtures: `mkdir -p "fixture/113062113 (名字)"` folders with an mp4 and optional
  pdf, `zip -r`. A folder without a video becomes a `No video in folder` row that is excluded from
  `Grade all (N)`. A student ID absent from the sheet keeps the folder name and falls back to the
  video filename as topic (info toast); present IDs get name/topic/group/date from the sheet.
- `Grade all` submits sequentially through `usePresentationGrading.submit` — with the mock
  OpenAI the whole queue finishes in seconds, so screenshot the `Submitting…`/`Started` mix
  quickly or rely on the CDP `net.log` ordering (WAV PUT → `/jobs` 201 → `/process`, repeated).
- Help card collapse state lives in `localStorage["presentation-grading-help-collapsed"]`.
- Mobile check without resizing the X window: drive `Emulation.setDeviceMetricsOverride`
  over CDP on the tab (see `/home/ubuntu/zip-evidence/cdp_viewport.mjs`). Note the override sticks
  to that target even after `clearDeviceMetricsOverride` from a separate CDP session — open a new
  tab to get back to desktop width.
- A React "change in the order of Hooks called by RosterCard" console error can appear during a
  Fast Refresh while the lead edits that component (`HotReload` in the stack); it is an HMR
  artifact, not a runtime bug — re-check on the final commit after a full reload before reporting.
- Resetting the CDP viewport override reliably: `clearDeviceMetricsOverride` alone may leave the
  tab narrow. Send `clear` → `setDeviceMetricsOverride {width:0,height:0,deviceScaleFactor:0,
  mobile:false}` → `clear` → `Page.reload` in one session (pattern in
  `/home/ubuntu/pr90-evidence/cdp_clear.mjs`), and match the target by full URL — with two
  PhysTutor tabs open, `url.includes("localhost")` may hit the wrong one.

## Report grading (`/report-grading`): batch PDFs / eeClass zips + sheet topic & report question

- Needs migration `20260913000000_report_topic_and_assigned_question` (`PresentationRosterEntry.
  reportTopic`, `ReportGradingJob.assignedQuestion`) on the scratch DB, plus the roster migration.
- `useReportGrading.ts` uploads each PDF with `@vercel/blob` client `upload()` to
  `/api/upload/client`; for a local run swap it for a PUT to a capture server and let
  `isUploadedBlobUrl` in `src/lib/chat-attachments.ts` accept that origin (mark both edits
  `E2E-TEST-STUB` and `git checkout` them at teardown). Uploaded PDFs land in the capture dir — the
  `.zip` must never appear there (zips are parsed client-side by `parseReportZip`).
- The mock OpenAI must answer `/v1/responses` with a *report* evaluation JSON when the prompt
  contains `REPORT INFORMATION` (see `/home/ubuntu/pr90-evidence/mock_openai.py`); the
  presentation-shaped mock makes report jobs fail. Save request bodies to assert on
  `Presentation topic (report title):` / `Additional report question:` (or the
  `none set — grade the report against the presentation topic` fallback) and on `input_file` (PDF)
  vs `<report>` (paste-text).
- Fixtures: eeClass-style zip = folders `109062362 (林鍵鋒)/x.pdf`; add `index.html`,
  `content.html`, `.DS_Store`, `__MACOSX/…/._x.pdf`, a `.txt` to prove they are ignored (exactly one
  row per PDF). Direct PDFs derive the ID from a 9-digit run in the filename
  (`王小明_113062113_期末報告.pdf`); a filename without one yields the amber "No student ID" row.
  GTK chooser multi-select: `Ctrl+L` then `"/path/a.zip" "/path/b.zip"`.
- The live sheet's `Report Topic` column may be blank for every real student; to see the
  Assigned-question path, set `reportTopic` on one roster row via
  `npx prisma db execute --stdin` (and NULL it afterwards / disclose it). `psql` is not installed.
- Submission is sequential per row (PUT → `POST /api/report-grading/jobs` 201 → `/process`), but
  `/process` is fire-and-forget, so with the mock all three finish within ~1 s and the
  `Uploading report 1/3…` label is not observable — rely on `net.log` + capture-server timestamps.
- Help-card key: `localStorage["report-grading-help-collapsed"]`. Expected unmatched-ID roster
  lookup is a `404` (console "Failed to load resource") and a garbage zip logs the jszip
  "Can't find end of central directory" error — both expected, not bugs.

## Grading result pages: human scores (Total only / Per item) + "Email feedback to the student"

- Both cards render only when the AI result parses (`ReportGradedView` / `PresentationGradedView`);
  a legacy job whose `summaryJson` has no scorecard is the negative case (no email card, no score
  card). Seed DONE jobs directly (`prisma.reportGradingJob.create` with a parsed `resultJson`) —
  no OpenAI/Blob needed. Include a presentation job with `topicSuggestions` and one with `null`
  (the draft omits the "Suggested report topics" heading only for the latter) and jobs whose
  `studentId` (a) has a roster `email`, (b) is rostered without one, (c) is not rostered.
- Native `<input type=number min max>` blocks out-of-range submits, so prove the server bounds
  (`PUT …/human-scores {total: 11}` → 400) with a same-origin `fetch` from the page as the TA.
  Store async results on `window.__v` and read them in a second console call — the console tool
  returns `{}` for a still-pending promise.
- **Email safety (user rule: no mail to real students).** The imported sheet's roster `email` is
  NULL for all rows unless the header has `E-mail/信箱`; set fake `@e2e.local` addresses on the
  roster rows you use. `src/lib/email.ts` hardcodes `service: "gmail"`, so with fake creds the
  send fails 502 (`EAUTH`) — acceptable, proves nothing is stamped. For a real *success* path
  without internet mail: temporary `E2E-TEST-STUB` in `email.ts` that swaps `service: "gmail"` for
  `{host:"127.0.0.1", port: E2E_SMTP_PORT, secure:false, ignoreTLS:true}` and run
  `/home/ubuntu/pr94-evidence/smtp_sink.mjs` (stores `.eml`, 550-rejects recipients outside
  `@e2e.local`/`@example.com`). Revert the stub with `git checkout src/lib/email.ts`.
- With Gmail unset, *every* POST returns 503 before the job lookup, so the 404-unknown-job check
  needs the configured (sink) server. Success writes `feedbackSentAt/To` + AuditLog
  `grading_feedback_emailed` (bulk-email `details` shape; `recipientIds` holds the user id when the
  address is a platform account, else the raw address) and shows up at `/admin/email-records` as
  "Grading feedback sent by <staff>".
- Watch the sign-off: the draft uses NextAuth `useSession()`; under the E2E cookie this may resolve
  to the *seeded student* name instead of the effective TA — compare it against the visible
  identity before calling it a pass.
- Restarting `next dev` mid-recording produces `[Topbar] Failed to fetch …` console errors and a
  spinner for ~10 s; note the timestamps so the console sweep can attribute them.

## Verifying real Vercel Blob behaviour (preview deployment, no local stub)

Blob-storage bugs (e.g. pathname collisions, token options such as `addRandomSuffix`) cannot be
proven with the local `BLOB_READ_WRITE_TOKEN`-less fallback — test against the branch's Vercel
PREVIEW deployment instead, which shares production's DB and Blob store.

- Find the preview: `curl -s "https://api.vercel.com/v6/deployments?projectId=physics-ai-tutor-platform&limit=5&target=preview" -H "Authorization: Bearer $VERCEL_TOKEN"`
  (bind `VERCEL_TOKEN` via the exec `env` param; never print it). Check `meta.githubCommitRef` /
  `githubCommitSha` and `readyState == READY`, then poll `/login` for 200.
- Previews are public; credentials login with a verified account stays on the preview host even
  though `NEXTAUTH_URL` points at production (the session cookie is per-host).
- The browser Blob PUT goes to `https://vercel.com/api/blob/?pathname=<name>` (NOT
  `blob.vercel-storage.com`) — filter network capture on `vercel.com/api/blob` or `/api/blob`.
  Attach a CDP `Network.requestWillBeSent`/`responseReceived` listener to the existing Chrome
  page (`http://localhost:29229/json`) *before* the first upload; anything before attach is lost.
- Easiest proof of stored URLs: read transcript chip hrefs after sending —
  `[...document.querySelectorAll('main a[href*="blob.vercel-storage.com"], main img[src*="blob.vercel-storage.com"]')]`.
  With `addRandomSuffix` the pathname is `<stem>-<30 random chars>.<ext>`.
- `/api/chat/conversations` returns HTML, not JSON — don't try to list attachments via it.
- Chat uploads count against `/api/upload/quota` (60 images/h, 30 documents/day, 150 MiB/day)
  on the shared prod DB; a 14-upload suite uses 12 of the daily document quota, so budget it.
- Sidebar "Delete conversation" needs the second confirming click within **3 s** or the state
  resets; deleting the active conversation collapses the list panel (reopen via "Open conversation list").
- Cleanup: delete only conversations you created (timestamps in the sidebar) — the shared DB
  also holds other testers' probe conversations.

## Canvas simulations (`/simulations/<id>`, e.g. gauss-law)

Sims are pure client-side canvas — no API, no DB rows to inspect. Prove behaviour visually:

- Read the on-canvas HUD (`Config:`, `Q_enc:`, `Flux Φ:`, `Surface R:`) with `zoom` on the top-left
  panel; compute expected values from the physics module in `src/lib/simulation/` first
  (e.g. Φ = Q_enc/ε₀ with ε₀ = 8.854187817e-12, 1 canvas px = 1 mm for enclosure geometry).
- Count field rays on the outermost ring in a zoomed screenshot; ray count formulas live in the
  physics module (`fieldRayCount`), so assert exact numbers (4 / 12 / 24), not "more/fewer".
- Sliders: focus the `<input type=range>` and use arrow keys (step = the input's `step`); if a
  value is unreachable by keyboard, set `.value` + dispatch `input` from the page and screenshot.
  Slider maxima in the UI may exceed the nominal spec (e.g. 22 cm vs "20 cm") — report the real max.
- Dragging the surface: `mouse_move` → `left_mouse_down` (no coordinate) → `mouse_move` → screenshot
  while held → `left_mouse_up`. Passing a coordinate to `left_mouse_down` is rejected.
- Challenge modes randomise config/charge/radius: use Skip until the wanted config appears, and
  read the canvas HUD to confirm it matches the description text (a past regression drew the
  student's own config instead). After a correct answer the sim auto-advances after ~2 s, and
  **Exit Challenge keeps the challenge's config/charge/radius** — don't mistake that for a bug.
- "Reset" in the current implementation resets charge/radius/centre but NOT the config button.
- Dark mode: `/settings` → Appearance → Dark (next-themes, no toggle in the user menu). Revert to
  Light at teardown — it persists in localStorage across sessions.
- Notes cards use `SimMath` (KaTeX). A literal `·` inside `\text{}` renders as red `\cdotp`
  (pre-existing in several sims' constants lines) — report it, don't count it as a PR error.
- 375 px: the 307 px canvas puts the HUD over the Gaussian surface and the challenge input
  shrinks to ~90 px (placeholder overlaps the unit); functional but worth flagging.

## Teardown

```bash
# NOTE: `pkill -f "next dev"` also matches the shell running it when issued through the exec tool
# (the pattern is in the command line) — run pkill in its own call, then continue in a fresh call.
pkill -f "next dev"; pkill -f "next-server"; sleep 4
ss -ltn | grep 3900 || echo PORT_CLOSED
docker exec physics-ai-tutor-platform-db-1 psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DB;"
rm -rf /home/ubuntu/prXX-uploads /home/ubuntu/prXX-files prXX-seed.ts
git status --porcelain   # must be empty
```

## Devin Secrets Needed

None for local QA. A Google client secret would be required only to exercise the real OAuth
callback; Vercel log access would be required to confirm production email/notification recipients.
