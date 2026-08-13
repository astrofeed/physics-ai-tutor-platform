"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage: string;
}

interface RecentConversationsCardProps {
  conversations: RecentConversation[];
}

export function RecentConversationsCard({ conversations }: RecentConversationsCardProps) {
  return (
    <div className="card-minimal animate-fade-in">
      <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
        <h3 className="section-title">Recent conversations</h3>
        <Link
          href="/chat"
          className="flex items-center gap-1 text-caption font-medium text-primary hover:underline"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="px-5 py-4">
        {conversations.length === 0 ? (
          <div className="py-6">
            <p className="text-body text-gray-900 dark:text-gray-100">No conversations yet</p>
            <p className="mt-1 text-caption text-muted-foreground">
              Ask the tutor about a problem you are stuck on.
            </p>
            <Link
              href="/chat"
              className="mt-4 inline-flex items-center gap-1.5 text-body font-medium text-primary hover:underline"
            >
              Start a conversation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border" role="list" aria-label="Recent conversations">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="-mx-2 flex items-baseline gap-4 px-2 py-3 transition-colors first:pt-0 hover:bg-secondary/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-gray-900 dark:text-gray-100">
                    {conv.title}
                  </p>
                  <p className="mt-0.5 truncate text-caption text-muted-foreground">
                    {conv.lastMessage}
                  </p>
                </div>
                <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                  {formatShortDate(conv.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
