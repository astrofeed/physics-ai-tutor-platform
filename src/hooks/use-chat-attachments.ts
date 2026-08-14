"use client";

import { useCallback, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENTS_PER_DAY,
  MAX_DOCUMENT_BYTES_PER_DAY,
  MAX_IMAGES_PER_HOUR,
  classifyAttachment,
  formatBytes,
  type AttachmentKind,
} from "@/lib/chat-attachments";
import type { DocumentAttachment } from "@/components/chat/types";

export interface PendingAttachment {
  file: File;
  kind: AttachmentKind;
  mimeType: string;
  /** Data URL preview, images only. */
  previewUrl?: string;
}

export interface UploadedAttachments {
  imageUrls: string[];
  documents: DocumentAttachment[];
}

function readPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Holds the files staged for the next message and uploads them to Blob.
 * Limits mirror the server ones in `@/lib/chat-attachments`; the server is
 * still the authority, so failures here are only for fast feedback.
 */
export function useChatAttachments() {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const clear = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const remove = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const selectFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const staged: PendingAttachment[] = [];
      for (const file of files) {
        const spec = classifyAttachment(file.name, file.type);
        if (!spec) {
          setError(`"${file.name}" is not a supported file. Use an image, PDF, .md, or .txt file.`);
          return;
        }
        if (file.size > spec.maxBytes) {
          setError(`"${file.name}" exceeds the ${formatBytes(spec.maxBytes)} limit for this file type.`);
          return;
        }
        staged.push({
          file,
          kind: spec.kind,
          mimeType: spec.mimeType,
          previewUrl: spec.kind === "image" ? await readPreview(file) : undefined,
        });
      }

      setAttachments((prev) => {
        if (prev.length + staged.length > MAX_ATTACHMENTS_PER_MESSAGE) {
          setError(`You can attach at most ${MAX_ATTACHMENTS_PER_MESSAGE} files to a message.`);
          return prev;
        }
        setError(null);
        return [...prev, ...staged];
      });
    },
    []
  );

  /**
   * Checks the user's remaining allowance so a rejected upload can be
   * explained: the Blob client hides the token endpoint's error message.
   */
  const quotaError = useCallback(async (): Promise<string | null> => {
    const images = attachments.filter((a) => a.kind === "image");
    const documents = attachments.filter((a) => a.kind === "document");
    const documentBytes = documents.reduce((sum, a) => sum + a.file.size, 0);

    const res = await fetch("/api/upload/quota");
    if (!res.ok) return null;
    const quota: {
      imagesRemainingThisHour: number;
      documentsRemainingToday: number;
      documentBytesRemainingToday: number;
    } = await res.json();

    if (images.length > quota.imagesRemainingThisHour) {
      return `Image upload limit reached (${MAX_IMAGES_PER_HOUR} per hour). Please try again later.`;
    }
    if (documents.length > quota.documentsRemainingToday) {
      return `Document upload limit reached (${MAX_DOCUMENTS_PER_DAY} files per day). Please try again tomorrow.`;
    }
    if (documentBytes > quota.documentBytesRemainingToday) {
      return `Daily document budget reached (${formatBytes(MAX_DOCUMENT_BYTES_PER_DAY)} per day). Please try again tomorrow.`;
    }
    return null;
  }, [attachments]);

  /** Uploads every staged file; returns null and sets an error on failure. */
  const uploadAll = useCallback(async (): Promise<UploadedAttachments | null> => {
    const result: UploadedAttachments = { imageUrls: [], documents: [] };
    if (!attachments.length) return result;

    const blocked = await quotaError();
    if (blocked) {
      setError(blocked);
      return null;
    }

    for (const attachment of attachments) {
      const { file, kind, mimeType } = attachment;
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload/client",
          contentType: mimeType,
          clientPayload: JSON.stringify({
            filename: file.name,
            contentType: mimeType,
            sizeBytes: file.size,
          }),
        });

        if (kind === "image") {
          result.imageUrls.push(blob.url);
        } else {
          result.documents.push({
            url: blob.url,
            filename: file.name,
            mimeType,
            sizeBytes: file.size,
          });
        }
      } catch {
        setError(`Failed to upload "${file.name}". Please try again.`);
        return null;
      }
    }

    return result;
  }, [attachments, quotaError]);

  return { attachments, error, selectFiles, remove, clear, clearError, uploadAll };
}
