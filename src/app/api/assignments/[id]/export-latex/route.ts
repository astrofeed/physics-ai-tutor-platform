import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertToLatex, escapeLatex } from "@/lib/latex-utils";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { readBytesForUrl } from "@/lib/services/file-storage";
import JSZip from "jszip";
import path from "path";

interface QuestionRecord {
  id: string;
  questionText: string;
  questionType: "MC" | "NUMERIC" | "FREE_RESPONSE";
  options: string[] | null;
  correctAnswer: string | null;
  points: number;
  order: number;
  diagram?: { type: string; content: string } | null;
  imageUrl?: string | null;
}

function getDiagramContent(
  diagram: unknown
): { type: string; content: string } | null {
  if (!diagram) return null;
  if (typeof diagram === "object" && diagram !== null) {
    const d = diagram as Record<string, unknown>;
    if (d.content && typeof d.content === "string") {
      return {
        type: String(d.type || "svg").toLowerCase(),
        content: d.content,
      };
    }
    if (d.svg && typeof d.svg === "string")
      return { type: "svg", content: d.svg };
    if (d.mermaid && typeof d.mermaid === "string")
      return { type: "mermaid", content: d.mermaid };
    if (d.code && typeof d.code === "string")
      return {
        type: String(d.type || "svg").toLowerCase(),
        content: d.code,
      };
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        questions: { orderBy: { order: "asc" } },
        createdBy: { select: { name: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const zip = new JSZip();
    const imagesFolder = zip.folder("images")!;
    const title = escapeLatex(assignment.title);
    const date = assignment.dueDate
      ? new Date(assignment.dueDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    // Check if any questions have SVG diagrams
    const questions = assignment.questions as unknown as QuestionRecord[];
    const hasSvg = questions.some((q) => {
      const diag = getDiagramContent(q.diagram);
      return diag?.type === "svg";
    });

    // Build LaTeX content for each question
    const questionBlocks: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = i + 1;
      const lines: string[] = [];

      lines.push(
        `\\noindent\\textbf{Question ${qNum}} (${q.points} point${q.points !== 1 ? "s" : ""})\\\\\\\\\n`
      );
      lines.push(convertToLatex(q.questionText));
      lines.push("");

      // Handle image
      if (q.imageUrl) {
        try {
          const image = await readBytesForUrl(q.imageUrl);
          if (!image) throw new Error("Image not available");
          const imgFilename = `q${qNum}-image${path.extname(image.filename) || ".png"}`;
          imagesFolder.file(imgFilename, image.bytes);
          lines.push("");
          lines.push(
            `\\begin{center}\n\\includegraphics[width=0.6\\textwidth]{${imgFilename}}\n\\end{center}`
          );
          lines.push("");
        } catch {
          lines.push(
            `% Image not found: ${escapeLatex(q.imageUrl)}`
          );
        }
      }

      // Handle diagrams
      const diag = getDiagramContent(q.diagram);
      if (diag) {
        if (diag.type === "svg") {
          const svgFilename = `diagram-q${qNum}.svg`;
          imagesFolder.file(svgFilename, diag.content);
          lines.push("");
          lines.push(
            `\\begin{center}\n\\includesvg[width=0.6\\textwidth]{images/${svgFilename}}\n\\end{center}`
          );
          lines.push("");
        } else if (diag.type === "mermaid") {
          lines.push("");
          lines.push(
            `% [Mermaid diagram \\textemdash{} see online version]`
          );
          lines.push("");
        }
      }

      // Handle MC options
      if (
        q.questionType === "MC" &&
        q.options &&
        Array.isArray(q.options) &&
        q.options.length > 0
      ) {
        lines.push("\\begin{enumerate}[(A)]");
        for (const opt of q.options) {
          lines.push(`  \\item ${convertToLatex(String(opt))}`);
        }
        lines.push("\\end{enumerate}");
        lines.push("");
      }

      // Correct answer
      if (q.correctAnswer) {
        lines.push(
          `\\textbf{Answer:} ${convertToLatex(q.correctAnswer)}`
        );
        lines.push("");
      }

      lines.push("\\bigskip\\hrule\\bigskip");
      questionBlocks.push(lines.join("\n"));
    }

    // A FILE_UPLOAD assignment has no questions, so its description carries the
    // submission instructions; without it the exported body would be empty.
    const descriptionBlock = assignment.description
      ? `${convertToLatex(assignment.description)}\n\n\\bigskip\n\n`
      : "";

    // Assemble full LaTeX document
    const packages = [
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage{amsmath,amssymb}",
      "\\usepackage{graphicx}",
      ...(hasSvg ? ["\\usepackage{svg}"] : []),
      "\\usepackage[margin=1in]{geometry}",
      "\\usepackage{enumerate}",
      "\\usepackage{fancyhdr}",
    ];

    const tex = `\\documentclass[12pt]{article}
${packages.join("\n")}
\\graphicspath{{./images/}}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\thepage}
\\lhead{${title}}
\\title{${title}}
\\date{${escapeLatex(date)}}

\\begin{document}
\\maketitle

${descriptionBlock}${questionBlocks.join("\n\n")}

\\end{document}
`;

    zip.file("assignment.tex", tex);

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    const safeFilename = assignment.title
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60);

    return new NextResponse(zipBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFilename}_latex.zip"`,
      },
    });
  } catch (error) {
    console.error("Export LaTeX error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
