import { PRESENTATION_QUESTION_BANK } from "@/data/presentation-question-bank";
import type { QuestionBankCandidate, QuestionBankMatch } from "@/types/question-bank";

const MAX_CANDIDATES = 5;
const MIN_SEARCH_SCORE = 0.3;
const WORD_WEIGHT = 0.6;
const WORD_PATTERN = new RegExp("[\\p{L}\\p{N}]+", "gu");
const QUESTIONS_BY_ID = new Map(PRESENTATION_QUESTION_BANK.map((q) => [q.id, q]));

export function normalizeQuestionTitle(title: string): string {
  return title.normalize("NFC").toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ").trim();
}

export function questionBankEntry(id: string) {
  return QUESTIONS_BY_ID.get(id) ?? null;
}

export function resolveQuestionBankMatch(topic: string, confirmedId: string | null): QuestionBankMatch {
  if (confirmedId !== null) {
    const question = questionBankEntry(confirmedId);
    return { question, status: question ? "confirmed" : "unavailable" };
  }
  const title = normalizeQuestionTitle(topic);
  const matches = PRESENTATION_QUESTION_BANK.filter((q) => normalizeQuestionTitle(q.title) === title);
  return matches.length === 1
    ? { question: matches[0], status: "exact" }
    : { question: null, status: "unmatched" };
}

function diceSimilarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of Array.from(left)) if (right.has(token)) shared++;
  return (2 * shared) / (left.size + right.size);
}

function bigrams(text: string): Set<string> {
  return new Set(Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => text.slice(i, i + 2)));
}

const SEARCH_INDEX = PRESENTATION_QUESTION_BANK.map((question) => {
  const title = normalizeQuestionTitle(question.title);
  return { question, title, words: new Set(title.match(WORD_PATTERN) ?? []), pairs: bigrams(title) };
});

export function findQuestionBankCandidates(query: string): QuestionBankCandidate[] {
  const title = normalizeQuestionTitle(query).slice(0, 200);
  if (!title) return [];
  const words = new Set(title.match(WORD_PATTERN) ?? []);
  const pairs = bigrams(title);
  return SEARCH_INDEX.map((entry) => ({
    question: entry.question,
    score: title === entry.title || title === entry.question.id ? 1
      : entry.title.includes(title) ? 0.9
      : WORD_WEIGHT * diceSimilarity(words, entry.words) + (1 - WORD_WEIGHT) * diceSimilarity(pairs, entry.pairs),
  })).filter(({ score }) => score >= MIN_SEARCH_SCORE)
    .sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id))
    .slice(0, MAX_CANDIDATES);
}
