"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown-content";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatShortDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

interface ConversationEntry {
  id: string;
  title: string;
  userName: string;
  userEmail: string;
  userVerified: boolean;
  messageCount: number;
  updatedAt: string;
  messages?: {
    id: string;
    role: string;
    content: string;
    imageUrls?: string[];
    createdAt: string;
  }[];
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

function QAHistoryPageContent() {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchConversations = useCallback((userId?: string, p?: number, ps?: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (userId && userId !== "all") params.set("userId", userId);
    params.set("page", String(p ?? 1));
    params.set("pageSize", String(ps ?? 15));
    fetch(`/api/admin/qa-history?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setTotalCount(data.totalCount ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConversations(selectedUserId, page, pageSize);
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        const userList = (data.users || []).map(
          (u: { id: string; name: string | null; email: string }) => ({
            id: u.id,
            name: u.name || "Unknown",
            email: u.email,
          })
        );
        setUsers(userList);
      })
      .catch((err) => console.error("[admin] Failed to fetch users:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchConversations(selectedUserId, page, pageSize);
  }, [page, pageSize, fetchConversations, selectedUserId]);

  const handleUserChange = (value: string) => {
    setSelectedUserId(value);
    setExpandedId(null);
    setPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const toggleExpand = async (convId: string) => {
    if (expandedId === convId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(convId);

    const conv = conversations.find((c) => c.id === convId);
    if (conv?.messages) return;

    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, messages: data.messages } : c
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVerified =
      verifiedFilter === "all" ||
      (verifiedFilter === "verified" && c.userVerified) ||
      (verifiedFilter === "unverified" && !c.userVerified);
    return matchesSearch && matchesVerified;
  });

  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400 dark:text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Q&A History</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Browse all user conversations ({totalCount} total)
        </p>
      </div>

      <div className="flex gap-3">
        <Select value={selectedUserId} onValueChange={handleUserChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={verifiedFilter} onValueChange={(v) => setVerifiedFilter(v as "all" | "verified" | "unverified")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Students" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="verified">Verified Only</SelectItem>
            <SelectItem value="unverified">Unverified Only</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          <Input
            placeholder="Search by title, user name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400 dark:text-neutral-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conv) => (
            <Card key={conv.id}>
              <button
                onClick={() => toggleExpand(conv.id)}
                className="w-full text-left"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <MessageSquare className="h-4 w-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {conv.userName} ({conv.userEmail})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <Badge variant="secondary" className="text-xs">
                        {conv.messageCount} messages
                      </Badge>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {formatShortDate(conv.updatedAt)}
                      </span>
                      {expandedId === conv.id ? (
                        <ChevronUp className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </button>

              {expandedId === conv.id && (
                <div className="border-t dark:border-gray-700 px-4 pb-4">
                  {loadingMessages ? (
                    <div className="py-4 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400 dark:text-neutral-500 mx-auto" />
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="space-y-3">
                        {conv.messages?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-3 text-sm ${
                              msg.role === "user"
                                ? "bg-neutral-900 text-white ml-8 dark:bg-neutral-800"
                                : "bg-neutral-100 mr-8 dark:bg-neutral-800 dark:text-neutral-200"
                            }`}
                          >
                            <p className="text-xs opacity-60 mb-1">
                              {msg.role === "user" ? "Student" : "AI"} -{" "}
                              {formatShortDate(msg.createdAt)}
                            </p>
                            {msg.imageUrls && msg.imageUrls.length > 0 && (
                              <div className={`mb-2 gap-2 ${msg.imageUrls.length === 1 ? "flex" : "grid grid-cols-2"}`}>
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
                            {msg.role === "assistant" ? (
                              <div className="prose-sm overflow-x-auto">
                                <MarkdownContent content={msg.content} />
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                <p className="text-sm text-neutral-400 dark:text-neutral-500">
                  {searchQuery ? "No conversations match your search." : "No conversations yet."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span>Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QAHistoryPage() {
  return (
    <StaffOnly>
      <QAHistoryPageContent />
    </StaffOnly>
  );
}
