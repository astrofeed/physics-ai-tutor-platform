"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import {
  GENERATED_NUMERIC_TOLERANCE_PERCENT,
  keyContradictsSolution,
} from "@/lib/generated-problem";
import dynamic from "next/dynamic";

const MermaidDiagram = dynamic(() => import("@/components/chat/MermaidDiagram"), { ssr: false });

interface GeneratedProblem {
  id?: string;
  questionText: string;
  questionType: string;
  options?: string[] | null;
  correctAnswer: string;
  solution: string;
  points: number;
  diagram?: string | { type: string; content: string } | null;
}

function getDiagramContent(diagram: GeneratedProblem["diagram"]): { type: string; content: string } | null {
  if (!diagram) return null;
  if (typeof diagram === "object" && "type" in diagram && "content" in diagram) {
    return diagram as { type: string; content: string };
  }
  if (typeof diagram === "string") {
    const trimmed = diagram.trim();
    if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
      return { type: "svg", content: trimmed };
    }
    if (trimmed.startsWith("graph") || trimmed.startsWith("flowchart") || trimmed.startsWith("sequenceDiagram")) {
      return { type: "mermaid", content: trimmed };
    }
  }
  return null;
}

interface GeneratedProblemCardProps {
  problem: GeneratedProblem;
  index: number;
  isCopied: boolean;
  onCopy: (index: number) => void;
}

export function GeneratedProblemCard({ problem, index, isCopied, onCopy }: GeneratedProblemCardProps) {
  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Problem {index + 1}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {problem.points} pts
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(index)}
          className={`gap-1.5 text-xs ${
            isCopied
              ? "text-emerald-600"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          {isCopied ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {isCopied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <div className="p-6 space-y-4">
        <MarkdownContent
          content={problem.questionText}
          className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
        />

        {(() => {
          const diag = getDiagramContent(problem.diagram);
          if (!diag) return null;
          return (
            <div className="my-3 flex justify-center">
              {diag.type === "svg" ? (
                <div
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-auto max-w-full [&_svg]:w-full [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: diag.content }}
                />
              ) : (
                <MermaidDiagram content={diag.content} />
              )}
            </div>
          );
        })()}

        {problem.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {problem.options.map((opt, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold shrink-0 mt-0.5">
                  {String.fromCharCode(65 + i)}
                </span>
                <MarkdownContent content={opt} className="text-sm text-gray-700 dark:text-gray-300" />
              </div>
            ))}
          </div>
        )}

        {keyContradictsSolution(problem) && (
          <div className="flex items-start gap-2 rounded-lg p-4 bg-amber-50 border border-amber-200 text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm">
              This answer&apos;s value never appears in the solution below — the key is probably wrong.
              Check it before using this problem.
            </p>
          </div>
        )}

        <div className="rounded-lg p-4 bg-emerald-50 border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-700 mb-1.5 uppercase tracking-wider">
            Correct Answer
          </p>
          <MarkdownContent content={problem.correctAnswer} className="text-sm text-emerald-800 font-medium" />
          {problem.questionType === "NUMERIC" && (
            <p className="text-xs text-emerald-700 mt-1.5">
              Auto-graded within &plusmn;{GENERATED_NUMERIC_TOLERANCE_PERCENT}%; editable per question once this
              becomes an assignment.
            </p>
          )}
        </div>

        <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Solution
          </p>
          <MarkdownContent content={problem.solution} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
        </div>
      </div>
    </div>
  );
}
