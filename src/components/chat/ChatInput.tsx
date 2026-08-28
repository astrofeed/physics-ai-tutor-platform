"use client";

import React, { useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, X, Square, RotateCcw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_MESSAGE,
  formatBytes,
} from "@/lib/chat-attachments";
import type { PendingAttachment } from "@/hooks/use-chat-attachments";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  loading: boolean;
  attachments: PendingAttachment[];
  attachmentError: string | null;
  onSelectFiles: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
  onClearAttachmentError: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  onRetry: () => void;
  canRetry: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  loading,
  attachments,
  attachmentError,
  onSelectFiles,
  onRemoveAttachment,
  onClearAttachmentError,
  onSubmit,
  onKeyDown,
  onStop,
  onRetry,
  canRetry,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus();
    }
  }, [loading]);

  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  return (
    <>
      {attachmentError && (
        <div className="px-4 py-2 border-t border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <span className="text-sm text-red-600 dark:text-red-400">{attachmentError}</span>
            <button
              onClick={onClearAttachmentError}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-3xl mx-auto flex gap-2 flex-wrap">
            {attachments.map((attachment, idx) => (
              <div key={idx} className="relative inline-block">
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className="h-20 rounded-lg object-contain border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="h-20 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 flex flex-col justify-center gap-1">
                    <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                      {attachment.file.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatBytes(attachment.file.size)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  aria-label={`Remove ${attachment.file.name}`}
                  className="absolute -top-2 -right-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full p-1 shadow-sm transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <span className="self-end text-xs text-gray-400 dark:text-gray-500 pb-1">
              {attachments.length}/{MAX_ATTACHMENTS_PER_MESSAGE}
            </span>
          </div>
        </div>
      )}

      <div className="p-2 pb-3 sm:p-4">
        {canRetry && (
          <div className="max-w-3xl mx-auto mb-2 flex justify-center">
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry last message
            </button>
          </div>
        )}
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              onChange={(e) => {
                onSelectFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
              className="hidden"
              aria-label="Upload image, PDF, or Markdown file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Attach a file"
              title="Attach an image, PDF, .md, or .txt file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                onInputChange(e.target.value);
                autoResizeTextarea();
              }}
              onKeyDown={onKeyDown}
              placeholder="Ask a physics question..."
              aria-label="Message input"
              disabled={loading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none py-2 px-1 max-h-32 leading-relaxed disabled:opacity-50"
              style={{ minHeight: "36px" }}
            />
            {loading ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                title="Stop generating"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 transition-all"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !attachments.length}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all",
                  !input.trim() && !attachments.length
                    ? "bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : "bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="hidden sm:block text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </>
  );
}
