"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useUploadFile } from "@/hooks/useUploadFile";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-constraints";

/** The images and the single file a grader attaches to their feedback. */
export function useFeedbackAttachments() {
  const [images, setImages] = useState<Record<string, string[]>>({});
  const [file, setFile] = useState<{ file: File | null; url: string | null }>({
    file: null,
    url: null,
  });

  const { upload, uploading } = useUploadFile({
    maxSizeBytes: MAX_UPLOAD_BYTES,
    onSizeError: () => toast.error("File exceeds the 20 MB limit. Please use a smaller file."),
  });

  return {
    images,
    setImages,
    setImagesFor: (answerId: string, urls: string[]) =>
      setImages((prev) => ({ ...prev, [answerId]: urls })),
    file,
    /** Restores a URL kept in a local draft, without re-uploading. */
    setFileUrl: (url: string | null) => setFile({ file: null, url }),
    attach: async (chosen: File) => {
      setFile((prev) => ({ ...prev, file: chosen }));
      const url = await upload(chosen);
      if (url) setFile((prev) => ({ ...prev, url }));
    },
    clear: () => setFile({ file: null, url: null }),
    uploading,
  };
}
