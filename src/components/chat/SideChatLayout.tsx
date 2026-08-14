"use client";

import React from "react";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { SideChatPanel } from "./SideChatPanel";
import { useSideChatPanel } from "@/hooks/use-side-chat-panel";

interface SideChatLayoutProps {
  /** Shown in the panel header, e.g. the assignment title. */
  contextLabel?: string;
  children: React.ReactNode;
}

/** Page content with the AI tutor docked beside it in a resizable column. */
export function SideChatLayout({ contextLabel, children }: SideChatLayoutProps) {
  const { open, toggle, close, width, isMobile, resizing, startResize } = useSideChatPanel();

  return (
    <div className={cn("flex h-full min-h-0 gap-4", resizing && "select-none")}>
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>

      {open ? (
        <SideChatPanel
          contextLabel={contextLabel}
          width={width}
          isMobile={isMobile}
          onClose={close}
          onStartResize={startResize}
        />
      ) : (
        <button
          type="button"
          onClick={toggle}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white pl-4 pr-5 py-3 shadow-lg transition-colors"
        >
          <MessagesSquare className="h-4 w-4" />
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}
    </div>
  );
}
