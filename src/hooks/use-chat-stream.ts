"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message, Conversation, DocumentAttachment } from "@/components/chat/types";

interface UseChatStreamOptions {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  chatMode: "normal" | "socratic";
  onRestoreInput: (text: string) => void;
}

interface PendingRetry {
  text: string;
  imageUrls?: string[];
  documents?: DocumentAttachment[];
}

interface InFlightStream {
  convId: string | null;
  userMessage: Message;
  assistantMsgId: string;
  content: string;
  thinking: string;
}

export function useChatStream({
  activeConversationId,
  setActiveConversationId,
  setConversations,
  chatMode,
  onRestoreInput,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeConvRef = useRef(activeConversationId);
  const streamRef = useRef<InFlightStream | null>(null);

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  // Returns the messages of a stream still running for this conversation so a
  // re-opened conversation can show and keep receiving the in-progress reply.
  const getInFlightMessages = useCallback((convId: string): Message[] => {
    const stream = streamRef.current;
    if (!stream || stream.convId !== convId) return [];
    return [
      stream.userMessage,
      { id: stream.assistantMsgId, role: "assistant", content: stream.content, thinking: stream.thinking },
    ];
  }, []);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (
      messageText: string,
      uploadedUrls: string[],
      documents: DocumentAttachment[] = []
    ) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageText,
        imageUrls: uploadedUrls.length ? uploadedUrls : undefined,
        documents: documents.length ? documents : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setPendingRetry(null);
      setLoading(true);

      const assistantMsgId = (Date.now() + 1).toString();
      streamRef.current = {
        convId: activeConversationId,
        userMessage,
        assistantMsgId,
        content: "",
        thinking: "",
      };

      // Add empty assistant message that will be streamed into
      setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "", thinking: "" }]);

      let requestFailedBeforeStream = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConversationId,
            message: messageText,
            imageUrls: uploadedUrls.length ? uploadedUrls : undefined,
            documents: documents.length ? documents : undefined,
            mode: chatMode,
          }),
          signal: abortController.signal,
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
                if (streamRef.current) streamRef.current.convId = event.conversationId;
                if (activeConvRef.current === null) {
                  setActiveConversationId(event.conversationId);
                }
                setConversations((prev) => [
                  {
                    id: event.conversationId,
                    title: messageText.slice(0, 50) || "New Chat",
                    updatedAt: new Date().toISOString(),
                    folderId: null,
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
                if (streamRef.current) streamRef.current.thinking += event.content;
                const thinking = streamRef.current?.thinking;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, thinking: thinking ?? (msg.thinking || "") + event.content }
                      : msg
                  )
                );
              } else if (event.type === "delta") {
                if (streamRef.current) streamRef.current.content += event.content;
                const content = streamRef.current?.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: content ?? msg.content + event.content }
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
        if (err instanceof DOMException && err.name === "AbortError") {
          // User pressed Stop: keep whatever streamed so far, mark visibly
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content || "_Generation stopped._" }
                : msg
            )
          );
          return;
        }
        console.error("Chat error:", err);
        const errorMsg = err instanceof Error ? err.message : "Sorry, I encountered an error. Please try again.";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId && !msg.content
              ? { ...msg, content: errorMsg, error: true }
              : msg
          )
        );
        setPendingRetry({
          text: messageText,
          imageUrls: uploadedUrls.length ? uploadedUrls : undefined,
          documents: documents.length ? documents : undefined,
        });
        // Restore the input so the user can retry without retyping
        if (requestFailedBeforeStream) {
          onRestoreInput(messageText);
        }
      } finally {
        streamRef.current = null;
        abortControllerRef.current = null;
        setLoading(false);
      }
    },
    [activeConversationId, chatMode, setActiveConversationId, setConversations, onRestoreInput]
  );

  const retryLast = useCallback(() => {
    if (!pendingRetry || loading) return;
    // Clear the restored input so the retried text isn't accidentally sent twice
    onRestoreInput("");
    // Drop the failed user/assistant pair so the retry replaces it visually
    setMessages((prev) => {
      const next = [...prev];
      if (next.length >= 1 && next[next.length - 1].role === "assistant" && next[next.length - 1].error) {
        next.pop();
        if (next.length >= 1 && next[next.length - 1].role === "user") {
          next.pop();
        }
      }
      return next;
    });
    sendMessage(pendingRetry.text, pendingRetry.imageUrls || [], pendingRetry.documents || []);
  }, [pendingRetry, loading, sendMessage, onRestoreInput]);

  return {
    messages,
    setMessages,
    loading,
    sendMessage,
    stopGeneration,
    retryLast,
    getInFlightMessages,
    canRetry: pendingRetry !== null && !loading,
  };
}
