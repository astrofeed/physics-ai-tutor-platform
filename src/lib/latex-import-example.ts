/** Offered as a download in the import dialog, and the shape the parser is built around. */
export const LATEX_IMPORT_EXAMPLE = String.raw`\documentclass[12pt]{article}
\usepackage{amsmath}

\title{Chapter 5 Homework \\ Newton's Laws}

\begin{document}
\maketitle

Answer every question. Show your work where it is asked for.

\section*{Part A --- Multiple choice}

\noindent\textbf{Question 1} (10 points)\\
A $2\,\mathrm{kg}$ block accelerates at $4\,\mathrm{m/s^2}$. What is the net force?

\begin{enumerate}[(A)]
  \item 4 N
  \item 8 N
  \item 16 N
  \item 2 N
\end{enumerate}

\textbf{Answer:} B

\bigskip\hrule\bigskip

\noindent\textbf{Question 2} (10 points)\\
Which law explains why a passenger lurches forward when a bus brakes?

\begin{enumerate}[(A)]
  \item Newton's first law
  \item Newton's second law
  \item Newton's third law
\end{enumerate}

\textbf{Answer:} Newton's first law

\bigskip\hrule\bigskip

\section*{Part B --- Short answer}

\noindent\textbf{Question 3} (5 points)\\
What is the magnitude of $g$ near Earth's surface, in $\mathrm{m/s^2}$?

\textbf{Answer:} 9.8

\bigskip\hrule\bigskip

\noindent\textbf{Question 4} (20 points)\\
Explain why the normal force is not always equal to the weight of an object.

\textbf{Answer:} Because the normal force balances only the component of forces
perpendicular to the surface; on an incline, or when another vertical force acts,
it differs from $mg$.

\end{document}
`;

export const LATEX_IMPORT_EXAMPLE_FILENAME = "assignment-import-example.tex";
