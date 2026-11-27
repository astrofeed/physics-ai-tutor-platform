import type { HumanScoresInput, SaveHumanScoresResult } from "@/types/human-grading";

export function canManageReview(ownerId: string, requesterId: string, role?: string) {
  return ownerId === requesterId || role === "PROFESSOR" || role === "ADMIN";
}

export function validateAgainst(
  input: HumanScoresInput, maxByName: Map<string, number>, maxTotal: number
): SaveHumanScoresResult {
  if ("total" in input) {
    return input.total >= 0 && input.total <= maxTotal ? { ok: true }
      : { ok: false, status: 400, error: `Total must be between 0 and ${maxTotal}` };
  }
  const seen = new Set<string>();
  for (const entry of input.scores) {
    const max = maxByName.get(entry.name);
    if (max === undefined) return { ok: false, status: 400, error: `Unknown item: ${entry.name}` };
    if (seen.has(entry.name)) return { ok: false, status: 400, error: `Duplicate item: ${entry.name}` };
    if (!(entry.score >= 0 && entry.score <= max)) {
      return { ok: false, status: 400, error: `"${entry.name}" must be between 0 and ${max}` };
    }
    seen.add(entry.name);
  }
  return { ok: true };
}
