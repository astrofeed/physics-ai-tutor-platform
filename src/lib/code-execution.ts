/**
 * Sandbox endpoint for running code from chat, Piston-compatible
 * (`POST /execute` with `{ language, version, files }`).
 *
 * There is no default: the public `emkc.org` Piston instance became
 * allow-list-only and answers 401, so an unset endpoint means the feature is
 * off — the UI hides its Run buttons instead of offering an action that fails.
 */
export function codeExecutionEndpoint(): string | null {
  return process.env.CODE_EXEC_API_URL?.trim() || null;
}
