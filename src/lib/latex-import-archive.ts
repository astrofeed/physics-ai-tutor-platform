import JSZip from "jszip";
import {
  LatexImportError,
  MAX_IMPORT_LENGTH,
  parseLatexAssignment,
  type ImportIssue,
  type LatexImportResult,
  type ParsedQuestion,
} from "@/lib/latex-import";
import type { QuestionFormData } from "@/types/assignment";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/upload-constraints";

/** `export-latex` writes `assignment.tex` plus an `images/` folder into the archive. */
const IMAGE_EXTENSIONS = ALLOWED_UPLOAD_EXTENSIONS.filter((ext) => ext !== "pdf");
const MAX_ARCHIVE_ENTRIES = 500;

export interface LatexImport extends LatexImportResult {
  questions: ParsedQuestion[];
  /** Ready to merge into the assignment form, with archive figures attached. */
  formQuestions: QuestionFormData[];
}

function extension(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/** Figures are referenced as `q1-image.png` or `images/q1-image.png`, so match on the file name. */
function findAsset<T>(assets: Map<string, T>, reference: string): T | undefined {
  const direct = assets.get(reference);
  if (direct) return direct;

  const name = reference.split("/").pop() ?? reference;
  for (const [path, asset] of Array.from(assets.entries())) {
    if (path.split("/").pop() === name) return asset;
  }
  return undefined;
}

async function readArchive(file: File): Promise<{
  tex: string;
  images: Map<string, File>;
  svgs: Map<string, string>;
}> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && !entry.name.startsWith("/") && !entry.name.includes(".."))
    .slice(0, MAX_ARCHIVE_ENTRIES);

  const texEntry =
    entries.find((entry) => entry.name.endsWith("assignment.tex")) ??
    entries.find((entry) => extension(entry.name) === "tex");
  if (!texEntry) {
    throw new LatexImportError(
      "The archive contains no .tex file. Upload the .zip produced by “Export LaTeX”, or the .tex file on its own."
    );
  }

  const images = new Map<string, File>();
  const svgs = new Map<string, string>();

  for (const entry of entries) {
    const ext = extension(entry.name);
    if (ext === "svg") {
      svgs.set(entry.name, await entry.async("string"));
      continue;
    }
    if (!IMAGE_EXTENSIONS.includes(ext)) continue;

    const bytes = await entry.async("arraybuffer");
    if (bytes.byteLength > MAX_UPLOAD_BYTES) continue;
    images.set(
      entry.name,
      new File([bytes], entry.name.split("/").pop() ?? entry.name, {
        type: `image/${ext === "jpg" ? "jpeg" : ext}`,
      })
    );
  }

  return { tex: await texEntry.async("string"), images, svgs };
}

function toFormQuestion(
  question: ParsedQuestion,
  images: Map<string, File>,
  svgs: Map<string, string>
): QuestionFormData {
  const image = question.imagePath ? findAsset(images, question.imagePath) : undefined;
  const svg = question.svgPath ? findAsset(svgs, question.svgPath) : undefined;

  return {
    questionText: question.questionText,
    questionType: question.questionType,
    options: question.questionType === "MC" ? question.options : [],
    correctAnswer: question.correctAnswer,
    points: question.points,
    tolerance: null,
    toleranceUnit: "ABSOLUTE",
    ...(image && { imageFile: image, imagePreview: URL.createObjectURL(image) }),
    ...(svg && { diagram: { type: "svg" as const, content: svg } }),
  };
}

/**
 * Parses a pasted document or an uploaded `.tex`/`.zip` into questions the
 * assignment form can render. Figures found in an archive are attached to their
 * question so the form's existing upload path stores them.
 */
export async function readLatexImport(source: File | string): Promise<LatexImport> {
  const isArchive = typeof source !== "string" && extension(source.name) === "zip";
  const { tex, images, svgs } = isArchive
    ? await readArchive(source)
    : {
        tex: typeof source === "string" ? source : await source.text(),
        images: new Map<string, File>(),
        svgs: new Map<string, string>(),
      };

  if (!tex.trim()) {
    throw new LatexImportError("The document is empty.");
  }
  if (tex.length > MAX_IMPORT_LENGTH) {
    throw new LatexImportError(
      `The document is ${tex.length.toLocaleString()} characters; the limit is ${MAX_IMPORT_LENGTH.toLocaleString()}.`
    );
  }

  const result = parseLatexAssignment(tex);
  const figureIssues: ImportIssue[] = [];

  result.questions.forEach((question, index) => {
    const missing = [
      question.imagePath && !findAsset(images, question.imagePath) ? question.imagePath : null,
      question.svgPath && !findAsset(svgs, question.svgPath) ? question.svgPath : null,
    ].filter((path): path is string => path !== null);

    for (const path of missing) {
      figureIssues.push({
        questionNumber: index + 1,
        severity: "warning",
        message: `Uses the figure “${path}”, which is not in this upload. Import the .zip from “Export LaTeX”, or attach the image to the question after importing.`,
      });
    }
  });

  return {
    ...result,
    issues: [...result.issues, ...figureIssues].sort(
      (a, b) => a.questionNumber - b.questionNumber
    ),
    formQuestions: result.questions.map((question) =>
      toFormQuestion(question, images, svgs)
    ),
  };
}
