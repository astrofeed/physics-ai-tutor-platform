import { extractText, getDocumentProxy } from "unpdf";
import {
  MAX_EXTRACTED_CHARS,
  MAX_PDF_PAGES,
  PDF_MIME_TYPE,
  classifyAttachment,
} from "@/lib/chat-attachments";
import { logger } from "@/lib/logger";

export interface DocumentSource {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ExtractedDocument {
  text: string;
  truncated: boolean;
}

function truncate(text: string): ExtractedDocument {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= MAX_EXTRACTED_CHARS) {
    return { text: normalized, truncated: false };
  }
  return { text: normalized.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

async function extractPdf(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const readPages = pages.slice(0, MAX_PDF_PAGES);
  const extracted = truncate(
    readPages.map((page, index) => `[page ${index + 1}]\n${page}`).join("\n\n")
  );
  return { ...extracted, truncated: extracted.truncated || pages.length > MAX_PDF_PAGES };
}

/**
 * Downloads an uploaded document and returns the text handed to the model.
 * Extraction happens server-side so the feature works on any provider,
 * including ones without document or vision support.
 */
export async function extractDocumentText(
  source: DocumentSource
): Promise<ExtractedDocument | null> {
  const spec = classifyAttachment(source.filename, source.mimeType);
  if (!spec || spec.kind !== "document") return null;

  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Blob fetch failed with ${response.status}`);
    }

    // The size the client declared at upload time is not evidence; the stored
    // object is what we are about to read.
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > spec.maxBytes) {
      throw new Error(`Stored file is ${buffer.byteLength} bytes, over the limit`);
    }

    if (spec.mimeType === PDF_MIME_TYPE) {
      return await extractPdf(buffer);
    }
    return truncate(new TextDecoder().decode(buffer));
  } catch (error) {
    logger.error("Document extraction failed", {
      filename: source.filename,
      mimeType: spec.mimeType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
