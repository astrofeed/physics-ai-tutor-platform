import { normalizeMcAnswerKey, optionLetter } from "@/lib/mc-answer-key";

export const MAX_IMPORT_LENGTH = 500_000;
export const MAX_IMPORT_QUESTIONS = 200;

/** Thrown when nothing usable can be parsed, as opposed to a per-question issue. */
export class LatexImportError extends Error {}

export interface ParsedQuestion {
  questionText: string;
  questionType: "MC" | "NUMERIC" | "FREE_RESPONSE";
  options: string[];
  correctAnswer: string;
  points: number;
  /** `\includegraphics` target, as written in the document. Resolved from a .zip upload. */
  imagePath: string | null;
  /** `\includesvg` target, as written in the document. Resolved from a .zip upload. */
  svgPath: string | null;
}

export interface ImportIssue {
  /** 1-based position in the document, matching what the author sees. */
  questionNumber: number;
  message: string;
  /** Issues that leave the question importable but incomplete. */
  severity: "error" | "warning";
}

export interface LatexImportResult {
  title: string | null;
  /** `\subtitle`, the second line of a two-line `\title`, and any prose before the first question. */
  description: string;
  questions: ParsedQuestion[];
  issues: ImportIssue[];
}

/** Matches `\textbf{Question 3} (10 points)`, `\question[10]` and `\item[10 points]`. */
const QUESTION_HEADERS = [
  /\\textbf\s*\{\s*Question\s*\d*\s*\}\s*(?:\(\s*([\d.]+)\s*points?\s*\))?/gi,
  /\\question\s*(?:\[\s*([\d.]+)\s*\])?/g,
];

const OPTION_ENVIRONMENTS = ["enumerate", "itemize", "choices", "oneparchoices"];

/** Answers run to the end of the question block, since they are often several lines. */
const ANSWER_PATTERNS = [
  /\\textbf\s*\{\s*Answer\s*:?\s*\}\s*:?\s*([\s\S]*)/i,
  /\\(?:answer|correctanswer)\s*\{([^}]*)\}/i,
  /^\s*(?:Answer|Ans|答案)\s*[:：]\s*([\s\S]*)/im,
];

function stripComments(tex: string): string {
  return tex
    .split("\n")
    .map((line) => line.replace(/(^|[^\\])%.*$/, "$1"))
    .join("\n");
}

function extractDocumentBody(tex: string): string {
  const begin = tex.indexOf("\\begin{document}");
  if (begin === -1) return tex;
  const end = tex.indexOf("\\end{document}", begin);
  const body = end === -1 ? tex.slice(begin) : tex.slice(begin, end);
  return body.replace("\\begin{document}", "");
}

/**
 * `\title{Midterm \\ Chapters 1-4}` is the common way to write a subtitle, so the
 * first line becomes the assignment title and the rest joins the description.
 */
function extractHeadings(tex: string): { title: string | null; subtitle: string } {
  const titleMatch = /\\title\s*\{([\s\S]*?)\}/.exec(tex);
  const lines = titleMatch
    ? convertFromLatex(titleMatch[1])
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  const subtitleMatch = /\\subtitle\s*\{([\s\S]*?)\}/.exec(tex);
  const subtitle = [
    ...lines.slice(1),
    subtitleMatch ? convertFromLatex(subtitleMatch[1]).trim() : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { title: lines[0] ?? null, subtitle };
}

const SECTION_HEADING = /\\(?:section|subsection|part)\*?\s*\{([\s\S]*?)\}/;

/** Section headings group questions ("Part A"), so they are never questions themselves. */
function takeSectionHeadings(block: string): { headings: string[]; rest: string } {
  const headings: string[] = [];
  let rest = block;
  let match = SECTION_HEADING.exec(rest);

  while (match) {
    const heading = convertFromLatex(match[1]).trim();
    if (heading) headings.push(heading);
    rest = rest.replace(match[0], "\n");
    match = SECTION_HEADING.exec(rest);
  }

  return { headings, rest };
}

/** Inverse of `convertToLatex` in latex-utils: back to the Markdown + math the editor stores. */
export function convertFromLatex(text: string): string {
  return text
    .replace(/\\textbf\s*\{([^{}]*)\}/g, "**$1**")
    .replace(/\\(?:textit|emph)\s*\{([^{}]*)\}/g, "*$1*")
    .replace(/\\begin\{center\}|\\end\{center\}/g, "")
    .replace(/\\(?:noindent|bigskip|medskip|smallskip|hrule|par|maketitle|newpage|vfill)\b/g, "")
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\includesvg(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\\\/g, "\n")
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\textasciitilde\{\}/g, "~")
    .replace(/\\textasciicircum\{\}/g, "^")
    .replace(/\\textemdash\{\}/g, "—")
    .replace(/\\([&%#_{}$])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface QuestionBlock {
  block: string;
  points: number | null;
}

/**
 * Splits the body at question headers. Whatever precedes the first question is
 * intro prose (instructions, formula sheet) rather than a question.
 */
function splitIntoQuestionBlocks(body: string): {
  blocks: QuestionBlock[];
  intro: string;
} {
  for (const pattern of QUESTION_HEADERS) {
    const matches = Array.from(body.matchAll(pattern));
    if (matches.length === 0) continue;

    const blocks = matches.map((match, index) => {
      const start = match.index! + match[0].length;
      const end =
        index + 1 < matches.length ? matches[index + 1].index! : body.length;
      return {
        block: body.slice(start, end),
        points: match[1] ? Number(match[1]) : null,
      };
    });

    return {
      blocks: moveTrailingHeadingsForward(blocks),
      intro: body.slice(0, matches[0].index!),
    };
  }

  const listStart = body.indexOf("\\begin{enumerate}");
  return {
    blocks: moveTrailingHeadingsForward(splitTopLevelItems(body)),
    intro: listStart === -1 ? body : body.slice(0, listStart),
  };
}

/**
 * A section heading sits between two questions, so slicing at question headers
 * leaves it at the end of the previous block — it belongs to the next question.
 */
function moveTrailingHeadingsForward(blocks: QuestionBlock[]): QuestionBlock[] {
  const split = blocks.map(({ block, points }) => {
    const match = SECTION_HEADING.exec(block);
    return match
      ? { points, head: block.slice(0, match.index), tail: block.slice(match.index) }
      : { points, head: block, tail: "" };
  });

  return split.map(({ points, head }, index) => ({
    points,
    block: index > 0 ? `${split[index - 1].tail}\n${head}` : head,
  }));
}

/**
 * Fallback for documents that just number questions with a plain `enumerate`:
 * each top-level `\item` becomes a question, while nested lists stay as options.
 */
function splitTopLevelItems(body: string): { block: string; points: number | null }[] {
  const outer = /\\begin\{enumerate\}([\s\S]*)\\end\{enumerate\}/.exec(body);
  if (!outer) return [];

  const content = outer[1];
  const items: { block: string; points: number | null }[] = [];
  let depth = 0;
  let current: string | null = null;

  for (const line of content.split("\n")) {
    const opens = (line.match(/\\begin\{(?:enumerate|itemize|choices)\}/g) || []).length;
    const closes = (line.match(/\\end\{(?:enumerate|itemize|choices)\}/g) || []).length;
    const isTopLevelItem = depth === 0 && /^\s*\\item\b/.test(line);

    if (isTopLevelItem) {
      if (current !== null) items.push({ block: current, points: null });
      current = line.replace(/^\s*\\item\b/, "");
    } else if (current !== null) {
      current += `\n${line}`;
    }

    depth += opens - closes;
  }

  if (current !== null) items.push({ block: current, points: null });
  return items;
}

function extractOptions(block: string): { options: string[]; rest: string } {
  for (const env of OPTION_ENVIRONMENTS) {
    const pattern = new RegExp(
      `\\\\begin\\{${env}\\}(?:\\[[^\\]]*\\])?([\\s\\S]*?)\\\\end\\{${env}\\}`
    );
    const match = pattern.exec(block);
    if (!match) continue;

    const options = match[1]
      .split(/\\(?:item|choice|CorrectChoice)\b/)
      .slice(1)
      .map((option) => convertFromLatex(option))
      .filter((option) => option.length > 0);

    if (options.length === 0) continue;
    return { options, rest: block.replace(match[0], "\n") };
  }

  return { options: [], rest: block };
}

const GRAPHICS_PATTERNS: { key: "imagePath" | "svgPath"; pattern: RegExp }[] = [
  { key: "imagePath", pattern: /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/ },
  { key: "svgPath", pattern: /\\includesvg(?:\[[^\]]*\])?\{([^}]*)\}/ },
];

/** Figures live in the export's `images/` folder, so only a .zip import can resolve them. */
function extractGraphics(block: string): {
  imagePath: string | null;
  svgPath: string | null;
} {
  const graphics: { imagePath: string | null; svgPath: string | null } = {
    imagePath: null,
    svgPath: null,
  };

  for (const { key, pattern } of GRAPHICS_PATTERNS) {
    const match = pattern.exec(block);
    if (match) graphics[key] = match[1].trim();
  }

  return graphics;
}

/** `\CorrectChoice` (exam class) marks the answer inline rather than in an Answer line. */
function correctChoiceLetter(block: string): string | null {
  const markers = Array.from(block.matchAll(/\\(item|choice|CorrectChoice)\b/g));
  const index = markers.findIndex((m) => m[1] === "CorrectChoice");
  return index === -1 ? null : optionLetter(index);
}

function extractAnswer(block: string): { answer: string; rest: string } {
  for (const pattern of ANSWER_PATTERNS) {
    const match = pattern.exec(block);
    if (!match) continue;
    return {
      answer: convertFromLatex(match[1]),
      rest: block.replace(match[0], "\n"),
    };
  }
  return { answer: "", rest: block };
}

function parseBlock(
  raw: string,
  headerPoints: number | null,
  questionNumber: number,
  issues: ImportIssue[]
): ParsedQuestion | null {
  const inlineAnswer = correctChoiceLetter(raw);
  const graphics = extractGraphics(raw);
  const { headings, rest: withoutHeadings } = takeSectionHeadings(raw);
  const { options, rest: withoutOptions } = extractOptions(withoutHeadings);
  const { answer, rest } = extractAnswer(withoutOptions);
  const body = convertFromLatex(
    rest.replace(/\\bigskip\s*\\hrule\s*\\bigskip/g, "")
  );
  const questionText = [...headings.map((h) => `### ${h}`), body]
    .filter(Boolean)
    .join("\n\n");

  if (!body) {
    issues.push({
      questionNumber,
      severity: "error",
      message: "No question text was found, so this question was skipped.",
    });
    return null;
  }

  const points =
    headerPoints !== null && Number.isFinite(headerPoints) && headerPoints > 0
      ? headerPoints
      : 10;
  if (headerPoints === null) {
    issues.push({
      questionNumber,
      severity: "warning",
      message: "No point value was found; defaulted to 10 points.",
    });
  }

  if (options.length > 0) {
    return parseMultipleChoice({
      ...graphics,
      questionText,
      options,
      answer: inlineAnswer ?? answer,
      points,
      questionNumber,
      issues,
    });
  }

  const numeric = Number(answer.trim());
  if (answer.trim() && Number.isFinite(numeric)) {
    return {
      ...graphics,
      questionText,
      questionType: "NUMERIC",
      options: [],
      correctAnswer: answer.trim(),
      points,
    };
  }

  if (!answer) {
    issues.push({
      questionNumber,
      severity: "warning",
      message:
        "No answer was found. Imported as a free response question with no reference answer.",
    });
  }

  return {
    ...graphics,
    questionText,
    questionType: "FREE_RESPONSE",
    options: [],
    correctAnswer: answer,
    points,
  };
}

function parseMultipleChoice({
  questionText,
  options,
  answer,
  points,
  questionNumber,
  issues,
  imagePath,
  svgPath,
}: {
  questionText: string;
  options: string[];
  answer: string;
  points: number;
  questionNumber: number;
  issues: ImportIssue[];
  imagePath: string | null;
  svgPath: string | null;
}): ParsedQuestion {
  if (options.length < 2) {
    issues.push({
      questionNumber,
      severity: "warning",
      message: `Only ${options.length} option was found; add the missing options before saving.`,
    });
  }

  const letter = normalizeMcAnswerKey(answer, options);
  if (!letter) {
    issues.push({
      questionNumber,
      severity: "warning",
      message: answer
        ? `The answer "${answer}" matches none of the options; pick the correct one before saving.`
        : "No answer was found; pick the correct option before saving.",
    });
  }

  return {
    imagePath,
    svgPath,
    questionText,
    questionType: "MC",
    options,
    correctAnswer: letter ?? "",
    points,
  };
}

/**
 * Parses a LaTeX assignment (the shape `export-latex` produces, plus the common
 * `exam`/`enumerate` variants) into editable questions. Anything questionable is
 * reported per question number instead of failing the whole import, so the author
 * can import what parsed and fix the rest in the form.
 */
export function parseLatexAssignment(tex: string): LatexImportResult {
  if (tex.length > MAX_IMPORT_LENGTH) {
    throw new LatexImportError(
      `The document is ${tex.length.toLocaleString()} characters; the limit is ${MAX_IMPORT_LENGTH.toLocaleString()}.`
    );
  }

  const cleaned = stripComments(tex);
  const body = extractDocumentBody(cleaned);
  const { blocks, intro } = splitIntoQuestionBlocks(body);
  const issues: ImportIssue[] = [];
  const questions: ParsedQuestion[] = [];

  const imported = blocks.slice(0, MAX_IMPORT_QUESTIONS);
  for (let index = 0; index < imported.length; index++) {
    const question = parseBlock(
      imported[index].block,
      imported[index].points,
      index + 1,
      issues
    );
    if (question) questions.push(question);
  }

  if (blocks.length === 0) {
    throw new LatexImportError(
      'No questions were found. Each question needs a header such as "\\textbf{Question 1} (10 points)" or "\\question[10]", or the questions need to be items of an \\begin{enumerate} list.'
    );
  }

  if (blocks.length > MAX_IMPORT_QUESTIONS) {
    issues.push({
      questionNumber: MAX_IMPORT_QUESTIONS + 1,
      severity: "error",
      message: `Only the first ${MAX_IMPORT_QUESTIONS} questions were imported.`,
    });
  }

  const { title, subtitle } = extractHeadings(cleaned);
  const { headings: introHeadings, rest: introBody } = takeSectionHeadings(intro);
  const description = [subtitle, ...introHeadings, convertFromLatex(introBody)]
    .filter(Boolean)
    .join("\n\n");

  return { title, description, questions, issues };
}
