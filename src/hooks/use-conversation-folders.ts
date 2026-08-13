"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Conversation, ConversationFolder } from "@/components/chat/types";

interface UseConversationFoldersOptions {
  initialFolders: ConversationFolder[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export function useConversationFolders({
  initialFolders,
  setConversations,
}: UseConversationFoldersOptions) {
  const [folders, setFolders] = useState<ConversationFolder[]>(initialFolders);

  const createFolder = useCallback(async (name: string) => {
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        toast.error(await parseError(res, "Failed to create folder"));
        return false;
      }
      const data = await res.json();
      setFolders((prev) => [...prev, data.folder]);
      return true;
    } catch (err) {
      console.error("[folders] Create failed:", err);
      toast.error("Failed to create folder");
      return false;
    }
  }, []);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        toast.error(await parseError(res, "Failed to rename folder"));
        return false;
      }
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name } : f)));
      return true;
    } catch (err) {
      console.error("[folders] Rename failed:", err);
      toast.error("Failed to rename folder");
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await parseError(res, "Failed to delete folder"));
        return;
      }
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setConversations((prev) =>
        prev.map((c) => (c.folderId === folderId ? { ...c, folderId: null } : c))
      );
    } catch (err) {
      console.error("[folders] Delete failed:", err);
      toast.error("Failed to delete folder");
    }
  }, [setConversations]);

  const moveConversation = useCallback(
    async (conversationId: string, folderId: string | null) => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        });
        if (!res.ok) {
          toast.error(await parseError(res, "Failed to move conversation"));
          return;
        }
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, folderId } : c))
        );
      } catch (err) {
        console.error("[folders] Move failed:", err);
        toast.error("Failed to move conversation");
      }
    },
    [setConversations]
  );

  return { folders, createFolder, renameFolder, deleteFolder, moveConversation };
}
