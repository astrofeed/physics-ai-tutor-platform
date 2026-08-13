"use client";

import React from "react";
import { Trash2, Check, FolderInput, Folder, FolderMinus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationFolder } from "./types";

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  folders: ConversationFolder[];
  confirmDeleteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onMove: (conversationId: string, folderId: string | null) => void;
}

export function ConversationItem({
  conversation: conv,
  isActive,
  folders,
  confirmDeleteId,
  onSelect,
  onDelete,
  onMove,
}: ConversationItemProps) {
  const otherFolders = folders.filter((f) => f.id !== conv.folderId);

  return (
    <div
      onClick={() => onSelect(conv.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(conv.id); }}
      aria-label={`Conversation: ${conv.title}`}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "w-full text-left rounded-lg px-2 py-2 transition-all group cursor-pointer overflow-hidden",
        isActive
          ? "bg-gray-50 dark:bg-gray-800 font-semibold"
          : "hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
      )}
    >
      <div className="flex items-center gap-1">
        <p
          title={conv.title}
          className={cn(
            "text-sm truncate leading-tight min-w-0 flex-1",
            isActive
              ? "font-semibold text-gray-900 dark:text-gray-100"
              : "font-normal text-gray-600 dark:text-gray-400"
          )}
        >
          {conv.title}
        </p>
        {(otherFolders.length > 0 || conv.folderId) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                title="Move to folder"
                aria-label={`Move conversation ${conv.title} to folder`}
              >
                <FolderInput className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {otherFolders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={(e) => { e.stopPropagation(); onMove(conv.id, folder.id); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Folder className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </DropdownMenuItem>
              ))}
              {conv.folderId && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onMove(conv.id, null); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FolderMinus className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span>Remove from folder</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          onClick={(e) => onDelete(conv.id, e)}
          className={cn(
            "shrink-0 p-1 rounded-md transition-all",
            confirmDeleteId === conv.id
              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
          )}
          title={confirmDeleteId === conv.id ? "Click again to confirm" : "Delete conversation"}
        >
          {confirmDeleteId === conv.id ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
        {formatRelativeDate(conv.updatedAt)}
      </p>
    </div>
  );
}
