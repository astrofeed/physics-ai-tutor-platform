/**
 * Reads an LMS (eeClass) submission export in the browser and turns it into
 * one package per student: the presentation video, the slides if present,
 * and the student ID / name parsed from the folder or archive name.
 *
 * eeClass names the export `109062362 (林鍵鋒).zip` with a folder of the same
 * name containing the uploaded files plus a `content.html` stub; a bulk export
 * holds one such folder per student. macOS adds `__MACOSX/` and `._*` shadows.
 */

import JSZip from "jszip";
import { studentIdFromFilename } from "@/lib/report-grading";

const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "wmv", "avi", "mkv"] as const;
const SLIDES_EXTENSIONS = ["pdf", "pptx"] as const;

const VIDEO_MIME: Record<(typeof VIDEO_EXTENSIONS)[number], string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
};

const SLIDES_MIME: Record<(typeof SLIDES_EXTENSIONS)[number], string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export interface SubmissionPackage {
  /** Folder (or archive) name the files came from, e.g. "109062362 (林鍵鋒)". */
  label: string;
  studentId: string | null;
  studentName: string | null;
  video: File | null;
  slides: File | null;
  /** Video filename without extension — a usable topic when no roster matches. */
  topicHint: string | null;
}

function extensionOf(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : "";
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function isShadowEntry(path: string): boolean {
  const name = basename(path);
  return path.startsWith("__MACOSX/") || name.startsWith(".") || name === "content.html";
}

function isVideo(ext: string): ext is (typeof VIDEO_EXTENSIONS)[number] {
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

function isSlides(ext: string): ext is (typeof SLIDES_EXTENSIONS)[number] {
  return (SLIDES_EXTENSIONS as readonly string[]).includes(ext);
}

/** "109062362 (林鍵鋒)" → "林鍵鋒"; "王小明_113012345" → "王小明". */
export function studentNameFromLabel(label: string): string | null {
  const parenthesised = /\(([^()]+)\)/.exec(label);
  if (parenthesised) return parenthesised[1].trim() || null;
  const stripped = label
    .replace(/\.zip$/i, "")
    .replace(/\d{5,15}/g, "")
    .replace(/[_\-()\s]+/g, " ")
    .trim();
  return stripped || null;
}

/**
 * The folder a file belongs to: the outermost folder whose name carries a
 * student ID (so a wrapper folder around a bulk export is skipped), else the
 * file's immediate parent folder, else null for files at the archive root.
 */
function studentFolder(path: string): string | null {
  const folders = path.split("/").slice(0, -1);
  return (
    folders.find((folder) => studentIdFromFilename(folder) !== null) ??
    folders[folders.length - 1] ??
    null
  );
}

interface MediaEntry {
  entry: JSZip.JSZipObject;
  mimeType: string;
}

async function toFile({ entry, mimeType }: MediaEntry): Promise<File> {
  const blob = await entry.async("blob");
  return new File([blob], basename(entry.name), { type: mimeType, lastModified: entry.date.getTime() });
}

/**
 * Groups the archive's media by student folder and builds one package per
 * folder that contains a video or slides. Files at the archive root are
 * attributed to the archive name itself.
 */
export async function parseSubmissionZip(archive: File): Promise<SubmissionPackage[]> {
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const archiveLabel = archive.name.replace(/\.zip$/i, "");

  const groups = new Map<string, { video?: MediaEntry; slides?: MediaEntry }>();
  zip.forEach((path, entry) => {
    if (entry.dir || isShadowEntry(path)) return;
    const ext = extensionOf(path);
    if (!isVideo(ext) && !isSlides(ext)) return;

    const label = studentFolder(path) ?? archiveLabel;
    const group = groups.get(label) ?? {};
    if (isVideo(ext)) group.video ??= { entry, mimeType: VIDEO_MIME[ext] };
    else if (isSlides(ext)) group.slides ??= { entry, mimeType: SLIDES_MIME[ext] };
    groups.set(label, group);
  });

  const packages: SubmissionPackage[] = [];
  for (const [label, group] of Array.from(groups.entries())) {
    const video = group.video ? await toFile(group.video) : null;
    const slides = group.slides ? await toFile(group.slides) : null;
    packages.push({
      label,
      studentId: studentIdFromFilename(label) ?? studentIdFromFilename(archiveLabel),
      studentName: studentNameFromLabel(label) ?? studentNameFromLabel(archiveLabel),
      video,
      slides,
      topicHint: video ? video.name.replace(/\.[a-z0-9]+$/i, "").trim() || null : null,
    });
  }
  return packages.sort((a, b) => a.label.localeCompare(b.label));
}
