import "dotenv/config";
import { requireEnv } from "./load-test-env";

/**
 * Fires several autosaves for the same student at once — the pattern a flaky
 * network or two open tabs produces — to see whether the draft path stays
 * consistent (one submission, one answer row per question).
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const PASSWORD = requireEnv("LOAD_PASSWORD");
const PARALLEL = Number(process.env.RACE_PARALLEL ?? 6);

const assignmentId = process.argv[2];
const questionIds = (process.argv[3] ?? "").split(",").filter(Boolean);
const email = process.argv[4] ?? "load-student-199@e2e.local";

async function login() {
  const jar = new Map<string, string>();
  const store = (res: Response) => {
    const raws: string[] = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of raws) {
      const pair = raw.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  };
  const cookie = () =>
    Array.from(jar.entries())
      .map(([k, v]) => k + "=" + v)
      .join("; ");

  const csrfRes = await fetch(BASE_URL + "/api/auth/csrf");
  store(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await fetch(BASE_URL + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: new URLSearchParams({ email, password: PASSWORD, csrfToken, callbackUrl: BASE_URL }),
  });
  store(res);
  return cookie();
}

async function main() {
  const cookie = await login();
  const answers = (rev: number) =>
    questionIds.map((questionId, q) => ({
      questionId,
      answer: q % 2 === 0 ? "9.8" : "revision " + rev,
    }));

  const results = await Promise.all(
    Array.from({ length: PARALLEL }, (_, r) =>
      fetch(BASE_URL + "/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ assignmentId, answers: answers(r), isDraft: true }),
      }).then(async (res) => ({ status: res.status, body: (await res.text()).slice(0, 120) }))
    )
  );

  console.log(JSON.stringify(results, null, 2));
}

main();
