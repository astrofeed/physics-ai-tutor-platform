"use client";

import React, { useRef } from "react";
import { ImagePlus, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { isPdfUrl, MAX_UPLOAD_BYTES } from "@/lib/upload-constraints";

interface ImageUploadProps {
  images: string[]; // URLs of uploaded images
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  uploading?: boolean;
  onUpload: (file: File) => Promise<string | null>; // returns URL or null on failure
  className?: string;
  /** Lets students hand in a scanned or photographed PDF alongside photos. */
  allowPdf?: boolean;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function ImageUpload({
  images,
  onImagesChange,
  maxImages = 3,
  uploading = false,
  onUpload,
  className = "",
  allowPdf = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remaining);
    const uploaded = [...images];

    for (const file of filesToUpload) {
      const isPdf = file.type === "application/pdf";
      if (!file.type.startsWith("image/") && !(allowPdf && isPdf)) {
        toast.error(
          allowPdf
            ? `"${file.name}" is not an image or a PDF.`
            : `"${file.name}" is not an image.`
        );
        continue;
      }
      const limit = isPdf ? MAX_UPLOAD_BYTES : MAX_IMAGE_SIZE;
      if (file.size > limit) {
        toast.error(
          `"${file.name}" exceeds the ${Math.round(limit / 1024 / 1024)} MB limit. Please use a smaller file.`
        );
        continue;
      }
      const url = await onUpload(file);
      if (url) {
        uploaded.push(url);
        onImagesChange([...uploaded]);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className={className}>
      {/* Preview thumbnails */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {images.map((url, i) => (
            <div key={i} className="relative group">
              {isPdfUrl(url) ? (
                <span className="h-16 w-16 flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-300">
                  <FileText className="h-5 w-5" />
                  PDF
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
              )}
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {images.length < maxImages && (
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-dashed border-gray-300 dark:border-gray-600">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          <span>
            {uploading
              ? "Uploading..."
              : `${allowPdf ? "Attach photo or PDF" : "Attach image"} (${images.length}/${maxImages})`}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={allowPdf ? "image/*,application/pdf" : "image/*"}
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
