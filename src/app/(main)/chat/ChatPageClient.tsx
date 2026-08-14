"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTrackTime } from "@/lib/use-track-time";
import {
  PanelLeftOpen,
  PanelLeftClose,
  ShieldAlert,
  Lightbulb,
  X,
  Download,
  FileText,
  Printer,
  FoldVertical,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { exportAsMarkdown, exportAsPdf } from "@/components/chat/export-conversation";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useChatAttachments } from "@/hooks/use-chat-attachments";
import { useConversationFolders } from "@/hooks/use-conversation-folders";
import { useExamMode } from "@/hooks/use-exam-mode";
import { useStickyScroll } from "@/hooks/use-sticky-scroll";
import type { Conversation, ConversationFolder } from "@/components/chat/types";

interface ChatPageClientProps {
  conversations: Conversation[];
  folders: ConversationFolder[];
  userId: string;
  conversationLimit: number;
  /** Conversation to open on mount, from `/chat/[id]`. */
  initialConversationId?: string;
}

export default function ChatPageClient({
  conversations: initialConversations,
  folders: initialFolders,
  conversationLimit,
  initialConversationId,
}: ChatPageClientProps) {
  useTrackTime("AI_CHAT");
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpenRaw] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chatMode, setChatMode] = useState<"normal" | "socratic">("normal");
  const [examBannerDismissed, setExamBannerDismissed] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialConversationLoaded = useRef(false);
  const examModeActive = useExamMode();

  const { folders, createFolder, renameFolder, deleteFolder, moveConversation } =
    useConversationFolders({ initialFolders, setConversations });

  const {
    attachments,
    error: attachmentError,
    selectFiles,
    remove: removeAttachment,
    clear: clearAttachments,
    clearError: clearAttachmentError,
    uploadAll,
  } = useChatAttachments();

  const {
    messages,
    setMessages,
    loading,
    sendMessage,
    stopGeneration,
    retryLast,
    canRetry,
    getInFlightMessages,
  } = useChatStream({
    activeConversationId,
    setActiveConversationId,
    setConversations,
    chatMode,
    onRestoreInput: setInput,
  });

  useEffect(() => {
    const saved = localStorage.getItem("chat-sidebar-open");
    if (saved !== null) setSidebarOpenRaw(saved === "true");
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpenRaw(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const setSidebarOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setSidebarOpenRaw((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      localStorage.setItem("chat-sidebar-open", String(next));
      return next;
    });
  }, []);

  const { isPinned, scrollToBottom } = useStickyScroll(scrollContainerRef, messages);

  useEffect(() => {
    scrollToBottom("auto");
  }, [activeConversationId, scrollToBottom]);

  const loadConversation = useCallback(async (convId: string) => {
    setActiveConversationId(convId);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const inFlight = getInFlightMessages(convId);
        if (inFlight.length) {
          const [userMsg, assistantMsg] = inFlight;
          const last = data.messages[data.messages.length - 1];
          const prev = data.messages[data.messages.length - 2];
          const replyAlreadySaved =
            last?.role === "assistant" && prev?.role === "user" && prev.content === userMsg.content;
          if (replyAlreadySaved) {
            setMessages(data.messages);
            return;
          }
          const userAlreadySaved = last?.role === "user" && last.content === userMsg.content;
          setMessages(
            userAlreadySaved
              ? [...data.messages, assistantMsg]
              : [...data.messages, userMsg, assistantMsg]
          );
        } else {
          setMessages(data.messages);
        }
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, [isMobile, setSidebarOpen, setMessages, getInFlightMessages]);

  useEffect(() => {
    if (!initialConversationId || initialConversationLoaded.current) return;
    initialConversationLoaded.current = true;
    loadConversation(initialConversationId);
  }, [initialConversationId, loadConversation]);

  const createNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  };

  const submitMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() && !attachments.length) return;

    const uploaded = await uploadAll();
    if (!uploaded) return;

    setInput("");
    clearAttachments();
    scrollToBottom();
    await sendMessage(messageText, uploaded.imageUrls, uploaded.documents);
  }, [attachments.length, uploadAll, clearAttachments, sendMessage, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (input.trim() || attachments.length) {
        submitMessage(input);
      }
    }
  };

  const handleSuggestedTopic = (topic: string) => {
    setInput(topic);
    submitMessage(topic);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== convId) {
      setConfirmDeleteId(convId);
      setTimeout(() => setConfirmDeleteId((prev) => prev === convId ? null : prev), 3000);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await fetch(`/api/conversations/${convId}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        createNewChat();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const compressAndContinue = async () => {
    if (!activeConversationId || compressing) return;
    setCompressing(true);
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}/compress`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to compress conversation");
        return;
      }
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveConversationId(data.conversation.id);
      setMessages([data.summaryMessage]);
      toast.success("Conversation compressed into a new chat");
    } catch {
      toast.error("Failed to compress conversation. Please try again.");
    } finally {
      setCompressing(false);
    }
  };

  const copyMessage = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-[calc(100vh-5rem)] sm:h-[calc(100vh-6.5rem)] overflow-hidden -m-3 sm:-m-6">
      <ChatSidebar
        conversations={conversations}
        folders={folders}
        activeConversationId={activeConversationId}
        conversationLimit={conversationLimit}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectConversation={loadConversation}
        onNewChat={createNewChat}
        onDeleteConversation={deleteConversation}
        onMoveConversation={moveConversation}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        confirmDeleteId={confirmDeleteId}
        sidebarOpen={sidebarOpen}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950">
        {/* Chat Header */}
        <div className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-3 sm:px-4 shrink-0 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shrink-0"
              aria-label={sidebarOpen ? "Close conversation list" : "Open conversation list"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <PanelLeftOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight truncate">
                {activeConversation?.title || "New Conversation"}
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Physics AI Tutor</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {messages.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Export conversation"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => exportAsMarkdown(activeConversation?.title || "Conversation", messages)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span>Markdown (.md)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportAsPdf()}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-gray-500" />
                    <span>PDF (print)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {activeConversationId && messages.length > 0 && (
              <button
                type="button"
                onClick={compressAndContinue}
                disabled={compressing || loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Summarize this conversation and continue in a new chat"
              >
                {compressing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FoldVertical className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{compressing ? "Compressing…" : "Compress"}</span>
              </button>
            )}
            {!examModeActive && (
              <Button
                type="button"
                variant={chatMode === "socratic" ? "outline" : "ghost"}
                size="sm"
                onClick={() => setChatMode(chatMode === "socratic" ? "normal" : "socratic")}
                className={cn(
                  "h-8 gap-1.5 text-xs px-2 sm:px-3",
                  chatMode === "socratic"
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/60 hover:text-amber-800 dark:hover:text-amber-300"
                    : ""
                )}
                title="Socratic guided mode"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Socratic</span>
              </Button>
            )}

          </div>
        </div>

        {chatMode === "socratic" && !examModeActive && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-xs text-center">
            Socratic guided mode: AI will guide your thinking through questions rather than giving direct answers
          </div>
        )}

        {examModeActive && !examBannerDismissed && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center justify-center gap-1.5 relative">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Exam Mode: AI will provide guidance and help you understand concepts, but will not give direct answers
            <button
              onClick={() => setExamBannerDismissed(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <ChatMessageList
          messages={messages}
          copiedMessageId={copiedMessageId}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          showJumpToLatest={!isPinned && messages.length > 0}
          onJumpToLatest={scrollToBottom}
          onSuggestedTopic={handleSuggestedTopic}
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
      </div>
    </div>
  );
}
