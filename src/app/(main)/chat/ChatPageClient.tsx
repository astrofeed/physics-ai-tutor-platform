"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import { useTrackTime } from "@/lib/use-track-time";
import {
  Sparkles,
  Atom,
  PanelLeftOpen,
  PanelLeftClose,
  ShieldAlert,
  Lightbulb,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import type { Message, Conversation } from "@/components/chat/types";

interface ChatPageClientProps {
  conversations: Conversation[];
  userId: string;
  conversationLimit: number;
}

interface ModelOption {
  id: string;
  label: string;
  shortLabel: string;
  provider: string;
  icon: LucideIcon;
  color: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: "gpt-5.2", label: "GPT-5.2", shortLabel: "GPT-5.2", provider: "OpenAI", icon: Sparkles, color: "text-blue-500" },
  { id: "claude-haiku-4-5-20251001", label: "Claude 4.5 Haiku", shortLabel: "Claude", provider: "Anthropic", icon: Atom, color: "text-purple-500" },
];

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function ChatPageClient({
  conversations: initialConversations,
  conversationLimit,
}: ChatPageClientProps) {
  useTrackTime("AI_CHAT");
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [model, setModel] = useState("gpt-5.2");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpenRaw] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chatMode, setChatMode] = useState<"normal" | "socratic">("normal");
  const [examModeActive, setExamModeActive] = useState(false);
  const [examBannerDismissed, setExamBannerDismissed] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    fetch("/api/exam-mode")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setExamModeActive(data.isActive); })
      .catch((err) => console.error("[exam-mode] Failed to check exam mode:", err));
  }, []);

  const loadConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setLoading(false);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const createNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (imageFiles.length + files.length > MAX_IMAGES) {
      setImageError(`You can upload at most ${MAX_IMAGES} images at a time.`);
      return;
    }
    const oversized = files.find((f) => f.size > MAX_IMAGE_SIZE);
    if (oversized) {
      setImageError(`Image "${oversized.name}" exceeds the 5 MB limit. Please use a smaller image.`);
      return;
    }
    setImageError(null);
    setImageFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageError(null);
  };

  const clearImages = () => {
    setImageFiles([]);
    setImagePreviews([]);
    setImageError(null);
  };

  const submitMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() && !imageFiles.length) return;

    const uploadedUrls: string[] = [];

    for (const file of imageFiles) {
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload/client",
        });
        uploadedUrls.push(blob.url);
      } catch {
        setImageError("Failed to upload image. Please try again.");
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      imageUrls: uploadedUrls.length ? uploadedUrls : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    clearImages();
    setLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();

    // Add empty assistant message that will be streamed into
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "", thinking: "" }]);

    let requestFailedBeforeStream = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: messageText,
          imageUrls: uploadedUrls.length ? uploadedUrls : undefined,
          model,
          mode: chatMode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Chat request failed" }));
        requestFailedBeforeStream = true;
        throw new Error(errData.error || "Chat request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "meta" && event.conversationId && !activeConversationId) {
              setActiveConversationId(event.conversationId);
              setConversations((prev) => [
                {
                  id: event.conversationId,
                  title: messageText.slice(0, 50) || "New Chat",
                  updatedAt: new Date().toISOString(),
                },
                ...prev,
              ]);
            } else if (event.type === "title" && event.title && event.conversationId) {
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.id === event.conversationId
                    ? { ...conv, title: event.title }
                    : conv
                )
              );
            } else if (event.type === "thinking") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, thinking: (msg.thinking || "") + event.content }
                    : msg
                )
              );
            } else if (event.type === "delta") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content + event.content }
                    : msg
                )
              );
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg = err instanceof Error ? err.message : "Sorry, I encountered an error. Please try again.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && !msg.content
            ? { ...msg, content: errorMsg }
            : msg
        )
      );
      // Restore the input so the user can retry without retyping
      if (requestFailedBeforeStream) {
        setInput(messageText);
      }
    } finally {
      setLoading(false);
    }
  }, [activeConversationId, imageFiles, model, chatMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || imageFiles.length) {
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
        activeConversationId={activeConversationId}
        conversationLimit={conversationLimit}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectConversation={loadConversation}
        onNewChat={createNewChat}
        onDeleteConversation={deleteConversation}
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  {(() => {
                    const current = MODEL_OPTIONS.find((m) => m.id === model) || MODEL_OPTIONS[0];
                    const Icon = current.icon;
                    return (
                      <>
                        <Icon className={cn("h-3.5 w-3.5", current.color)} />
                        <span className="hidden sm:inline text-gray-700 dark:text-gray-200">{current.label}</span>
                        <span className="sm:hidden text-gray-700 dark:text-gray-200">{current.shortLabel}</span>
                      </>
                    );
                  })()}
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {(() => {
                  const providers = Array.from(new Set(MODEL_OPTIONS.map((m) => m.provider)));
                  return providers.map((provider, pi) => (
                    <React.Fragment key={provider}>
                      {pi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {provider}
                      </DropdownMenuLabel>
                      {MODEL_OPTIONS.filter((m) => m.provider === provider).map((opt) => {
                        const Icon = opt.icon;
                        const selected = model === opt.id;
                        return (
                          <DropdownMenuItem
                            key={opt.id}
                            onClick={() => setModel(opt.id)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Icon className={cn("h-4 w-4", opt.color)} />
                            <span className="flex-1">{opt.label}</span>
                            {selected && <Check className="h-3.5 w-3.5 text-gray-500" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
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
          onSuggestedTopic={handleSuggestedTopic}
          onCopyMessage={copyMessage}
        />

        <ChatInput
          input={input}
          onInputChange={setInput}
          loading={loading}
          imageFiles={imageFiles}
          imagePreviews={imagePreviews}
          imageError={imageError}
          onImageSelect={handleImageSelect}
          onRemoveImage={removeImage}
          onClearImageError={() => setImageError(null)}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
