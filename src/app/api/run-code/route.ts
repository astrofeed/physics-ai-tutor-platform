import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { consumeActionRateLimit } from "@/lib/services/action-rate-limit";
import { codeExecutionEndpoint } from "@/lib/code-execution";
import { logger } from "@/lib/logger";
import { z } from "zod";

const RunCodeSchema = z.object({
  code: z.string().min(1).max(50_000),
  language: z.string().min(1).max(50),
});

const MAX_EXECUTIONS_PER_HOUR = parseInt(process.env.CODE_EXEC_RATE_LIMIT || "20", 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.CODE_EXEC_RATE_WINDOW_MS || "3600000", 10);

// Map language names to Piston API language identifiers
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  js: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  ts: { language: "typescript", version: "5.0.3" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "c++", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
  go: { language: "go", version: "1.16.2" },
  rust: { language: "rust", version: "1.68.2" },
  ruby: { language: "ruby", version: "3.0.1" },
  php: { language: "php", version: "8.2.3" },
};

/** Lets the UI hide Run buttons when no sandbox is configured. */
export async function GET() {
  const auth = await requireApiAuth();
  if (isErrorResponse(auth)) return auth;

  return NextResponse.json({ enabled: codeExecutionEndpoint() !== null });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const endpoint = codeExecutionEndpoint();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Code execution is not configured on this deployment." },
        { status: 503 }
      );
    }

    const parsed = RunCodeSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Code and language are required" }, { status: 400 });
    }

    const { code, language } = parsed.data;
    const langConfig = LANGUAGE_MAP[language.toLowerCase()];

    if (!langConfig) {
      return NextResponse.json(
        { error: `Language "${language}" is not supported for execution` },
        { status: 400 }
      );
    }

    const rateLimit = await consumeActionRateLimit({
      userId: auth.user.id,
      action: "run_code",
      limit: MAX_EXECUTIONS_PER_HOUR,
      windowMs: RATE_LIMIT_WINDOW,
    });

    if (!rateLimit.allowed) {
      const minutesLeft = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 60000));
      return NextResponse.json(
        { error: `Rate limit exceeded. Please try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      );
    }

    const pistonResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: code }],
      }),
    });

    if (!pistonResponse.ok) {
      logger.error("Code sandbox rejected the request", {
        route: "/api/run-code",
        status: pistonResponse.status,
      });
      return NextResponse.json(
        { error: "Failed to execute code on remote server" },
        { status: 500 }
      );
    }

    const pistonData = await pistonResponse.json();

    if (pistonData.run) {
      const stdout = pistonData.run.stdout || "";
      const stderr = pistonData.run.stderr || "";
      const output = stdout || stderr || "No output";

      if (stderr && !stdout) {
        return NextResponse.json({ error: output });
      }

      return NextResponse.json({ output });
    }

    return NextResponse.json({ error: "Failed to execute code" });
  } catch (error) {
    logger.error("Run code failed", {
      route: "/api/run-code",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
