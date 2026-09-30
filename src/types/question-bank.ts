export interface QuestionBankEntry {
  id: string;
  chapter: number;
  title: string;
  track: "A" | "B" | "A + B";
  whatToDo: string;
}

export type QuestionBankRow = readonly [
  id: string,
  chapter: number,
  title: string,
  track: QuestionBankEntry["track"],
  whatToDo: string,
];

export interface QuestionBankCandidate {
  question: QuestionBankEntry;
  score: number;
}

export interface QuestionBankMatch {
  question: QuestionBankEntry | null;
  status: "confirmed" | "exact" | "unmatched" | "unavailable";
}
