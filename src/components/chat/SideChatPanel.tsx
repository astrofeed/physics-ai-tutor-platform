"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Lightbulb, Plus, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useChatAttachments } from "@/hooks/use-chat-attachments";
import { useExamMode } from "@/hooks/use-exam-mode";
import { useTrackTime } from "@/lib/use-track-time";

interface SideChatPanelProps {
  /** Shown under the panel title, e.g. the assignment the student is working on. */
  contextLabel?: string;
  width?: number;
  isMobile: boolean;
  onClose: () => void;
  onStartResize: (event: React.PointerEvent) => void;
}

/**
 * AI tutor docked beside page content so students can ask questions without
 * leaving what they are working on. Conversations are the same ones as on the
 * chat page, and every restriction (ban, rate limit, exam mode) is enforced by
 * `/api/chat` for both.
 */
export function SideChatPanel({
  contextLabel,
  width,
  isMobile,
  onClose,
  onStartResize,
}: SideChatPanelProps) {
  useTrackTime("AI_CHAT", "side-panel");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [chatMode, setChatMode] = useState<"normal" | "socratic">("normal");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const examModeActive = useExamMode();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    attachments,
    error: attachmentError,
    selectFiles,
    remove: removeAttachment,
    clear: clearAttachments,
    clearError: clearAttachmentError,
    uploadAll,
  } = useChatAttachments();

  // The panel has no conversation list of its own; new conversations show up on
  // the chat page, which loads them from the server.
  const ignoreConversationUpdates = useCallback(() => {}, []);

  const {
    messages,
    setMessages,
    loading,
    sendMessage,
    stopGeneration,
    retryLast,
    canRetry,
  } = useChatStream({
    activeConversationId,
    setActiveConversationId,
    setConversations: ignoreConversationUpdates,
    chatMode,
    onRestoreInput: setInput,
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    if (isNearBottom) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const submitMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() && !attachments.length) return;
    const uploaded = await uploadAll();
    if (!uploaded) return;
    setInput("");
    clearAttachments();
    await sendMessage(messageText, uploaded.imageUrls, uploaded.documents);
  }, [attachments.length, uploadAll, clearAttachments, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (input.trim() || attachments.length) submitMessage(input);
    }
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    clearAttachments();
  };

  const copyMessage = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <aside
      aria-label="AI tutor chat"
      style={isMobile ? undefined : { width }}
      className={cn(
        "flex flex-col min-h-0 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800",
        isMobile
          ? "fixed inset-x-0 bottom-0 top-14 z-40 border-t"
          : "relative shrink-0 border-l"
      )}
    >
      {!isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
          onPointerDown={onStartResize}
          className="absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-blue-400/60 active:bg-blue-500/70 transition-colors"
        />
      )}

      <div className="h-14 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-gray-100 dark:border-gray-800">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
            AI Tutor
          </h2>
          {contextLabel && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{contextLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!examModeActive && (
            <Button
              type="button"
              variant={chatMode === "socratic" ? "outline" : "ghost"}
              size="sm"
              onClick={() => setChatMode(chatMode === "socratic" ? "normal" : "socratic")}
              className={cn(
                "h-8 gap-1.5 text-xs px-2",
                chatMode === "socratic"
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/60 hover:text-amber-800 dark:hover:text-amber-300"
                  : ""
              )}
              title="Socratic guided mode"
            >
              <Lightbulb className="h-3.5 w-3.5" />
            </Button>
          )}
          <button
            type="button"
            onClick={startNewChat}
            disabled={loading}
            title="New chat"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <Link
            href={activeConversationId ? `/chat/${activeConversationId}` : "/chat"}
            target="_blank"
            title="Open in full chat page"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            title="Close chat panel"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {chatMode === "socratic" && !examModeActive && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-xs text-center">
          Socratic guided mode: AI will guide your thinking through questions rather than giving direct answers
        </div>
      )}

      {examModeActive && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center justify-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          Exam Mode: AI will guide you but will not give direct answers
        </div>
      )}

      <ChatMessageList
        messages={messages}
        copiedMessageId={copiedMessageId}
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        onSuggestedTopic={submitMessage}
        onCopyMessage={copyMessage}
      />

      <ChatInput
        input={input}
        onInputChange={setInput}
        loading={loading}
        attachments={attachments}
        attachmentError={attachmentError}
        onSelectFiles={selectFiles}
        onRemoveAttachment={removeAttachment}
        onClearAttachmentError={clearAttachmentError}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onStop={stopGeneration}
        onRetry={retryLast}
        canRetry={canRetry}
      />
    </aside>
  );
}
