"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  MessageSquare,
  Search,
  FolderPlus,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConversationItem } from "./ConversationItem";
import { FolderSection } from "./FolderSection";
import type { Conversation, ConversationFolder } from "./types";

interface ChatSidebarProps {
  conversations: Conversation[];
  folders: ConversationFolder[];
  activeConversationId: string | null;
  conversationLimit: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onMoveConversation: (conversationId: string, folderId: string | null) => void;
  onCreateFolder: (name: string) => Promise<boolean>;
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string) => void;
  confirmDeleteId: string | null;
  sidebarOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
}

export function ChatSidebar({
  conversations,
  folders,
  activeConversationId,
  conversationLimit,
  searchQuery,
  onSearchChange,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onMoveConversation,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  confirmDeleteId,
  sidebarOpen,
  isMobile,
  onClose,
}: ChatSidebarProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, sidebarOpen, onClose]);

  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const unfiledConversations = filteredConversations.filter((c) => !c.folderId);
  const isSearching = searchQuery.trim().length > 0;
  const visibleFolders = isSearching
    ? folders.filter((f) => filteredConversations.some((c) => c.folderId === f.id))
    : folders;

  const submitNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setNewFolderName("");
      return;
    }
    const ok = await onCreateFolder(name);
    if (ok) {
      setCreatingFolder(false);
      setNewFolderName("");
    }
  };

  return (
    <>
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          role="button"
          tabIndex={-1}
          aria-label="Close conversation sidebar"
        />
      )}

      <div
        className={cn(
          "bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-300 overflow-hidden",
          isMobile
            ? cn("fixed inset-y-0 left-0 z-50 w-72 shadow-xl", sidebarOpen ? "translate-x-0" : "-translate-x-full")
            : cn("relative shrink-0", sidebarOpen ? "w-72" : "w-0 border-r-0")
        )}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Conversations</h2>
            <div className="flex items-center gap-1.5">
              {isMobile && (
                <button
                  onClick={onClose}
                  title="Close sidebar"
                  aria-label="Close conversation sidebar"
                  className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setCreatingFolder(true)}
                title="New folder"
                aria-label="New folder"
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
              <Button
                onClick={onNewChat}
                size="sm"
                disabled={conversations.length >= conversationLimit}
                title={conversations.length >= conversationLimit ? `Limit of ${conversationLimit} conversations reached. Delete old ones first.` : "New conversation"}
                className="h-7 gap-1.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-3 w-3" />
                New
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              aria-label="Search conversations"
              className="pl-9 h-8 bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800 rounded-lg text-sm focus-visible:ring-gray-300"
            />
          </div>
          {creatingFolder && (
            <div className="flex items-center gap-1">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) submitNewFolder();
                  if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                }}
                placeholder="Folder name"
                maxLength={200}
                autoFocus
                aria-label="New folder name"
                className="h-8 text-sm flex-1 min-w-0"
              />
              <button
                onClick={submitNewFolder}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Create folder"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {conversations.length >= conversationLimit && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            You&apos;ve reached the limit of {conversationLimit} conversations. Delete old ones to start new chats.
          </div>
        )}

        <div className="flex-1 overflow-y-auto" role="list" aria-label="Conversations">
          <div className="px-4 pb-2 space-y-0.5">
            {visibleFolders.map((folder) => (
              <FolderSection
                key={folder.id}
                folder={folder}
                conversations={filteredConversations.filter((c) => c.folderId === folder.id)}
                folders={folders}
                activeConversationId={activeConversationId}
                confirmDeleteId={confirmDeleteId}
                onSelectConversation={onSelectConversation}
                onDeleteConversation={onDeleteConversation}
                onMoveConversation={onMoveConversation}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            ))}
            {unfiledConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={activeConversationId === conv.id}
                folders={folders}
                confirmDeleteId={confirmDeleteId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onMove={onMoveConversation}
              />
            ))}
            {filteredConversations.length === 0 && visibleFolders.length === 0 && (
              <div className="text-center py-8 px-4">
                <MessageSquare className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {searchQuery ? "No matching conversations" : "No conversations yet"}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange("")}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 mt-1 underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
