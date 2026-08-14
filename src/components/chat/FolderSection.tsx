"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConversationItem } from "./ConversationItem";
import type { Conversation, ConversationFolder } from "./types";

interface FolderSectionProps {
  folder: ConversationFolder;
  conversations: Conversation[];
  folders: ConversationFolder[];
  activeConversationId: string | null;
  confirmDeleteId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onMoveConversation: (conversationId: string, folderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string) => void;
}

export function FolderSection({
  folder,
  conversations,
  folders,
  activeConversationId,
  confirmDeleteId,
  onSelectConversation,
  onDeleteConversation,
  onMoveConversation,
  onRenameFolder,
  onDeleteFolder,
}: FolderSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submitRename = async () => {
    const name = renameValue.trim();
    if (!name || name === folder.name) {
      setRenaming(false);
      setRenameValue(folder.name);
      return;
    }
    const ok = await onRenameFolder(folder.id, name);
    if (ok) setRenaming(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    setConfirmingDelete(false);
    onDeleteFolder(folder.id);
  };

  return (
    <div>
      {renaming ? (
        <div className="flex items-center gap-1 px-1 py-1" onClick={(e) => e.stopPropagation()}>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submitRename();
              if (e.key === "Escape") { setRenaming(false); setRenameValue(folder.name); }
            }}
            maxLength={200}
            autoFocus
            aria-label="Folder name"
            className="h-7 text-sm flex-1 min-w-0"
          />
          <button
            onClick={submitRename}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setRenaming(false); setRenameValue(folder.name); }}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => setExpanded((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((prev) => !prev); }}
          aria-expanded={expanded}
          aria-label={`Folder: ${folder.name}`}
          className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all group"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
          )}
          <span
            title={folder.name}
            className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate min-w-0 flex-1"
          >
            {folder.name}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 group-hover:hidden">
            {conversations.length}
          </span>
          <div className="hidden group-hover:flex items-center shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(folder.name); }}
              className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              title="Rename folder"
              aria-label={`Rename folder ${folder.name}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={handleDeleteClick}
              className={cn(
                "p-1 rounded-md transition-all",
                confirmingDelete
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
              )}
              title={confirmingDelete ? "Click again to confirm (conversations are kept)" : "Delete folder"}
              aria-label={`Delete folder ${folder.name}`}
            >
              {confirmingDelete ? <Check className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="ml-4 border-l border-gray-100 dark:border-gray-800 pl-1.5 space-y-0.5">
          {conversations.map((conv) => (
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
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1.5">Empty folder</p>
          )}
        </div>
      )}
    </div>
  );
}
