"use client";

import React from "react";
import {
  Atom,
  Sparkles,
  Bot,
  User,
  Zap,
  Lightbulb,
  FlaskConical,
  ImageIcon,
  Check,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { MessageDocuments } from "./MessageDocuments";
import { cn } from "@/lib/utils";
import type { Message } from "./types";

const SUGGESTED_TOPICS = [
  { icon: Zap, label: "Explain Newton's Laws" },
  { icon: Atom, label: "Quantum mechanics basics" },
  { icon: Lightbulb, label: "How does light travel?" },
  { icon: FlaskConical, label: "Thermodynamics concepts" },
];

interface ChatMessageListProps {
  messages: Message[];
  copiedMessageId: string | null;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSuggestedTopic: (topic: string) => void;
  onCopyMessage: (messageId: string, content: string) => void;
}

export function ChatMessageList({
  messages,
  copiedMessageId,
  scrollContainerRef,
  messagesEndRef,
  onSuggestedTopic,
  onCopyMessage,
}: ChatMessageListProps) {
  return (
    <div ref={scrollContainerRef} id="chat-print-area" className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="h-16 w-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 flex items-center justify-center mb-6">
              <Atom className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              Start a Conversation
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm mb-10 leading-relaxed">
              Ask me anything about physics -- mechanics, electromagnetism,
              thermodynamics, optics, quantum mechanics, and more.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTED_TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  onClick={() => onSuggestedTopic(topic.label)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <topic.icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 transition-colors">
                    {topic.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-10 text-xs text-gray-400 dark:text-gray-500">
              <ImageIcon className="h-3.5 w-3.5" />
              Upload up to 5 images of a problem for visual analysis
            </div>
          </div>
        )}

        <div className="space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 group",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full self-start",
                  msg.error ? "bg-red-100 dark:bg-red-900/40" : "bg-gray-100 dark:bg-gray-800"
                )}>
                  {msg.error ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
              )}

              {msg.role === "user" ? (
                <div className="flex items-start gap-2 max-w-[75%]">
                  <button
                    onClick={() => onCopyMessage(msg.id, msg.content)}
                    className={cn(
                      "transition-all mt-2 p-1.5 rounded-md",
                      copiedMessageId === msg.id
                        ? "opacity-100 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : "opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    )}
                    title="Copy message"
                  >
                    {copiedMessageId === msg.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed">
                    {msg.documents && <MessageDocuments documents={msg.documents} />}
                    {msg.imageUrls && msg.imageUrls.length > 0 && (
                      <div className={cn(
                        "mb-3 gap-2",
                        msg.imageUrls.length === 1 ? "flex" : "grid grid-cols-2"
                      )}>
                        {msg.imageUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Uploaded ${idx + 1}`}
                            className="max-w-full rounded-lg max-h-60 object-contain"
                          />
                        ))}
                      </div>
                    )}
                    <div className="prose-sm overflow-x-auto">
                      <MarkdownContent content={msg.content} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm leading-relaxed py-1",
                    msg.error
                      ? "rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-red-700 dark:text-red-300"
                      : "text-gray-900 dark:text-gray-100"
                  )}>
                    {msg.imageUrls && msg.imageUrls.length > 0 && (
                      <div className={cn(
                        "mb-3 gap-2",
                        msg.imageUrls.length === 1 ? "flex" : "grid grid-cols-2"
                      )}>
                        {msg.imageUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Uploaded ${idx + 1}`}
                            className="max-w-full rounded-lg max-h-60 object-contain"
                          />
                        ))}
                      </div>
                    )}
                    {msg.thinking && (
                      <details className="mb-2 group/thinking">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 select-none">
                          <Sparkles className="h-3 w-3" />
                          <span className="font-medium">Thinking</span>
                          <svg className="h-3 w-3 transition-transform group-open/thinking:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="mt-1.5 pl-4 border-l-2 border-purple-200 dark:border-purple-800 text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                          {msg.thinking}
                        </div>
                      </details>
                    )}
                    {!msg.content ? (
                      <div className="flex items-center gap-1.5 py-1">
                        {msg.thinking ? (
                          <span className="text-xs text-purple-500 dark:text-purple-400 animate-pulse flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            Thinking...
                          </span>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="prose-sm overflow-x-auto">
                        <MarkdownContent content={msg.content} />
                      </div>
                    )}
                  </div>

                  {msg.content && !msg.error && (
                    <div className={cn(
                      "flex items-center gap-2 mt-1 transition-opacity",
                      copiedMessageId === msg.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <button
                        onClick={() => onCopyMessage(msg.id, msg.content)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all",
                          copiedMessageId === msg.id
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                        title="Copy message"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 dark:bg-gray-700 self-start">
                  <User className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
