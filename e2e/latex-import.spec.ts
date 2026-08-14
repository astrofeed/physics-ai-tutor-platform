/**
 * Parser-level checks for LaTeX assignment import. These run without a browser
 * or database: `npx playwright test latex-import`.
 */
import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { parseLatexAssignment, LatexImportError } from "../src/lib/latex-import";
import { readLatexImport } from "../src/lib/latex-import-archive";
import { LATEX_IMPORT_EXAMPLE } from "../src/lib/latex-import-example";

const exported = String.raw`\documentclass{article}
\title{Homework 3}
\begin{document}
\maketitle

\noindent\textbf{Question 1} (10 points)\\
What is the net force?

\begin{enumerate}[(A)]
  \item 4 N
  \item 8 N
\end{enumerate}

\textbf{Answer:} B

\bigskip\hrule\bigskip
\end{document}`;

test("imports the export-latex format round trip", () => {
  const result = parseLatexAssignment(exported);
  expect(result.title).toBe("Homework 3");
  expect(result.questions).toHaveLength(1);
  expect(result.questions[0]).toMatchObject({
    questionType: "MC",
    options: ["4 N", "8 N"],
    correctAnswer: "B",
    points: 10,
  });
  expect(result.issues).toEqual([]);
});

test("infers a type per question and keeps headings out of the question list", () => {
  const result = parseLatexAssignment(LATEX_IMPORT_EXAMPLE);
  expect(result.questions.map((q) => q.questionType)).toEqual([
    "MC",
    "MC",
    "NUMERIC",
    "FREE_RESPONSE",
  ]);
  expect(result.title).toBe("Chapter 5 Homework");
  expect(result.description).toContain("Newton's Laws");
  expect(result.description).toContain("Answer every question");
  expect(result.issues).toEqual([]);
});

test("normalizes an MC answer written as option text or a number", () => {
  const result = parseLatexAssignment(LATEX_IMPORT_EXAMPLE);
  expect(result.questions[1].correctAnswer).toBe("A");

  const numbered = parseLatexAssignment(String.raw`\begin{document}
\question[5]
Pick one.
\begin{itemize}
  \item first
  \item second
\end{itemize}
Answer: 2
\end{document}`);
  expect(numbered.questions[0].correctAnswer).toBe("B");
  expect(numbered.questions[0].points).toBe(5);
});

test("keeps a multi-line free-response answer intact", () => {
  const result = parseLatexAssignment(LATEX_IMPORT_EXAMPLE);
  expect(result.questions[3].correctAnswer).toContain("perpendicular to the surface");
});

test("reads \\CorrectChoice from the exam class", () => {
  const result = parseLatexAssignment(String.raw`\begin{document}
\question[10]
Which is a unit of force?
\begin{choices}
  \choice joule
  \CorrectChoice newton
\end{choices}
\end{document}`);
  expect(result.questions[0].correctAnswer).toBe("B");
});

test("reports the question number for an answer that matches no option", () => {
  const result = parseLatexAssignment(String.raw`\begin{document}
\textbf{Question 1} (10 points)\\
Pick one.
\begin{enumerate}[(A)]
  \item 4 N
  \item 8 N
\end{enumerate}
\textbf{Answer:} D

\textbf{Question 2} (10 points)\\
Pick one.
\begin{enumerate}[(A)]
  \item yes
  \item no
\end{enumerate}
\textbf{Answer:} A
\end{document}`);

  expect(result.questions).toHaveLength(2);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toMatchObject({ questionNumber: 1, severity: "warning" });
  expect(result.issues[0].message).toContain('"D"');
});

test("warns when a question has no answer at all", () => {
  const result = parseLatexAssignment(String.raw`\begin{document}
\textbf{Question 1} (10 points)\\
State Newton's second law.
\end{document}`);
  expect(result.questions[0].questionType).toBe("FREE_RESPONSE");
  expect(result.issues[0].questionNumber).toBe(1);
});

test("rejects a document with no recognizable questions", () => {
  expect(() => parseLatexAssignment(String.raw`\begin{document}
Just some prose about physics.
\end{document}`)).toThrow(LatexImportError);
});

test("attaches archive figures to their question", async () => {
  const zip = new JSZip();
  zip.file(
    "assignment.tex",
    String.raw`\begin{document}
\textbf{Question 1} (10 points)\\
Read the graph.
\begin{center}
\includegraphics[width=0.6\textwidth]{images/q1-image.png}
\end{center}
\textbf{Answer:} 3
\end{document}`
  );
  zip.file("images/q1-image.png", Buffer.from([137, 80, 78, 71]));
  const bytes = await zip.generateAsync({ type: "arraybuffer" });

  const result = await readLatexImport(new File([bytes], "assignment.zip"));
  expect(result.issues).toEqual([]);
  expect(result.formQuestions[0].imageFile?.name).toBe("q1-image.png");
  expect(result.formQuestions[0].questionText).not.toContain("includegraphics");
});

test("warns per question when a .tex references figures it cannot carry", async () => {
  const result = await readLatexImport(String.raw`\begin{document}
\textbf{Question 1} (10 points)\\
Read the graph.
\includegraphics{images/q1-image.png}
\textbf{Answer:} 3
\end{document}`);

  expect(result.formQuestions).toHaveLength(1);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toMatchObject({ questionNumber: 1, severity: "warning" });
  expect(result.issues[0].message).toContain("images/q1-image.png");
});

test("rejects an archive without a .tex file", async () => {
  const zip = new JSZip();
  zip.file("images/q1-image.png", Buffer.from([137, 80, 78, 71]));
  const bytes = await zip.generateAsync({ type: "arraybuffer" });

  await expect(readLatexImport(new File([bytes], "assignment.zip"))).rejects.toThrow(
    LatexImportError
  );
});
