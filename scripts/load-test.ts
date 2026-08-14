import "dotenv/config";
import { requireEnv } from "./load-test-env";

/**
 * Simulates N students working on a quiz at the same time: each one signs in,
 * loads the assignment, autosaves a draft a few times, then submits.
 *
 * Usage: BASE_URL=http://localhost:3100 npx tsx scripts/load-test.ts <assignmentId> <questionIds,csv>
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const STUDENTS = Number(process.env.LOAD_STUDENTS ?? 200);
const DRAFT_SAVES = Number(process.env.LOAD_DRAFT_SAVES ?? 5);
const PASSWORD = requireEnv("LOAD_PASSWORD");

const assignmentId = process.argv[2];
const questionIds = (process.argv[3] ?? "").split(",").filter(Boolean);

if (!assignmentId || questionIds.length === 0) {
  console.error("usage: tsx scripts/load-test.ts <assignmentId> <questionIds csv>");
  process.exit(1);
}

interface Sample {
  label: string;
  ms: number;
  status: number;
  ok: boolean;
}

const samples: Sample[] = [];
const errors: string[] = [];

function cookieHeader(jar: Map<string, string>) {
  return Array.from(jar.entries())
    .map(([k, v]) => k + "=" + v)
    .join("; ");
}

function storeCookies(jar: Map<string, string>, res: Response) {
  const raws: string[] = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const raw of raws) {
    const pair = raw.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

/** Signs in through NextAuth credentials so the run uses a real JWT session. */
async function login(email: string): Promise<Map<string, string> | null> {
  const jar = new Map<string, string>();
  const started = performance.now();
  try {
    const csrfRes = await fetch(BASE_URL + "/api/auth/csrf");
    storeCookies(jar, csrfRes);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    const res = await fetch(BASE_URL + "/api/auth/callback/credentials", {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookieHeader(jar),
      },
      body: new URLSearchParams({
        email,
        password: PASSWORD,
        csrfToken,
        callbackUrl: BASE_URL,
      }),
    });
    storeCookies(jar, res);
    const ok = Array.from(jar.keys()).some((k) => k.includes("session-token"));
    samples.push({
      label: "login (credentials)",
      ms: performance.now() - started,
      status: res.status,
      ok,
    });
    if (!ok && errors.length < 20) errors.push("login " + email + " -> " + res.status);
    return ok ? jar : null;
  } catch (err) {
    samples.push({ label: "login (credentials)", ms: performance.now() - started, status: 0, ok: false });
    if (errors.length < 20) errors.push("login threw: " + String(err).slice(0, 200));
    return null;
  }
}

async function call(label: string, cookie: string, path: string, init?: RequestInit) {
  const started = performance.now();
  try {
    const res = await fetch(BASE_URL + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        cookie,
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.text();
    samples.push({ label, ms: performance.now() - started, status: res.status, ok: res.ok });
    if (!res.ok && errors.length < 20) {
      errors.push(label + " " + res.status + ": " + body.slice(0, 200));
    }
  } catch (err) {
    samples.push({ label, ms: performance.now() - started, status: 0, ok: false });
    if (errors.length < 20) errors.push(label + " threw: " + String(err).slice(0, 200));
  }
}

function answersFor(i: number, revision: number) {
  return questionIds.map((questionId, q) => ({
    questionId,
    answer: q % 2 === 0 ? "9.8" : "Student " + i + " answer revision " + revision + ". ".repeat(20),
  }));
}

async function oneStudent(i: number) {
  const email = "load-student-" + i + "@e2e.local";
  const jar = await login(email);
  if (!jar) return;
  const cookie = cookieHeader(jar);

  await call("GET /assignments/[id] (page)", cookie, "/assignments/" + assignmentId);
  await call("GET /api/assignments/[id]", cookie, "/api/assignments/" + assignmentId);
  await call("GET /api/submissions", cookie, "/api/submissions?assignmentId=" + assignmentId);

  for (let r = 0; r < DRAFT_SAVES; r++) {
    await call("POST /api/submissions (draft)", cookie, "/api/submissions", {
      method: "POST",
      body: JSON.stringify({ assignmentId, answers: answersFor(i, r), isDraft: true }),
    });
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 400));
  }

  await call("POST /api/submissions (final)", cookie, "/api/submissions", {
    method: "POST",
    body: JSON.stringify({ assignmentId, answers: answersFor(i, DRAFT_SAVES), isDraft: false }),
  });
}

function pct(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const started = performance.now();
  const results = await Promise.allSettled(
    Array.from({ length: STUDENTS }, (_, i) => oneStudent(i))
  );
  const wall = performance.now() - started;

  const byLabel = new Map<string, Sample[]>();
  for (const s of samples) {
    const list = byLabel.get(s.label) ?? [];
    list.push(s);
    byLabel.set(s.label, list);
  }

  console.log(
    "\nstudents=" + STUDENTS + " wall=" + (wall / 1000).toFixed(1) + "s requests=" + samples.length
  );
  console.log(
    "student flows: " +
      results.filter((r) => r.status === "fulfilled").length +
      " ok, " +
      results.filter((r) => r.status === "rejected").length +
      " threw\n"
  );
  console.log(
    "label".padEnd(32),
    "n".padStart(5),
    "fail".padStart(5),
    "p50".padStart(8),
    "p95".padStart(8),
    "p99".padStart(8),
    "max".padStart(8)
  );
  for (const [label, list] of Array.from(byLabel.entries())) {
    const ms = list.map((s) => s.ms).sort((a, b) => a - b);
    const fails = list.filter((s) => !s.ok).length;
    console.log(
      label.padEnd(32),
      String(list.length).padStart(5),
      String(fails).padStart(5),
      pct(ms, 50).toFixed(0).padStart(8),
      pct(ms, 95).toFixed(0).padStart(8),
      pct(ms, 99).toFixed(0).padStart(8),
      ms[ms.length - 1].toFixed(0).padStart(8)
    );
  }

  const statuses = new Map<number, number>();
  for (const s of samples) statuses.set(s.status, (statuses.get(s.status) ?? 0) + 1);
  console.log("\nstatus codes:", Object.fromEntries(Array.from(statuses.entries())));
  if (errors.length) console.log("\nsample errors:\n" + errors.join("\n"));
}

main();
