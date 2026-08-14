"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState, useCallback } from "react";
import { Mail, CalendarClock, Send, Clock, Users } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Recipient {
  name: string | null;
  email: string;
}

interface EmailRecord {
  id: string;
  type: "sent" | "scheduled";
  userId: string;
  userName: string | null;
  userEmail: string;
  action: string;
  details: Record<string, unknown> | null;
  recipients: Recipient[];
  createdAt: string;
  scheduledAt: string | null;
  targetAt: string | null;
  status: string;
}

type FilterTab = "all" | "sent" | "scheduled";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SENT: { label: "Sent", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  PENDING: { label: "Scheduled", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

function EmailRecordsPageContent() {
  const [records, setRecords] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [filter, setFilter] = useState<FilterTab>("all");

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchRecords = useCallback((p: number, ps: number, f: FilterTab) => {
    setLoading(true);
    fetch(`/api/admin/email-records?page=${p}&pageSize=${ps}&filter=${f}`)
      .then((res) => res.json())
      .then((data) => {
        setRecords(data.records || []);
        setTotalCount(data.totalCount ?? 0);
        setSentCount(data.sentCount ?? 0);
        setScheduledCount(data.scheduledCount ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRecords(page, pageSize, filter);
  }, [page, pageSize, filter, fetchRecords]);

  const handleFilterChange = (tab: FilterTab) => {
    setFilter(tab);
    setPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Email Records
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          View sent and scheduled emails
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{sentCount + scheduledCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Sent
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{sentCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
              <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Scheduled
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{scheduledCount}</p>
        </div>
      </div>

      {/* Records List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        {/* Filter Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(["all", "sent", "scheduled"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleFilterChange(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                filter === tab
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              {tab === "all" ? "All" : tab === "sent" ? "Sent" : "Scheduled"}
              <span className="ml-1.5 text-xs text-gray-400">
                ({tab === "all" ? sentCount + scheduledCount : tab === "sent" ? sentCount : scheduledCount})
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <LoadingSpinner message="Loading..." />
          </div>
        ) : records.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Mail className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {filter === "scheduled" ? "No scheduled emails" : filter === "sent" ? "No sent emails" : "No email records yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {records.map((record) => {
              const senderName = (record.details?.performedByName as string) || record.userName || "Unknown";
              const recipientCount = (record.details?.recipientCount as number) || ((record.details?.recipientIds as string[])?.length || 0);
              const subject = (record.details?.subject as string) || "No subject";
              const message = (record.details?.message as string) || "";
              const badge = STATUS_BADGE[record.status] || STATUS_BADGE.SENT;
              const isScheduled = record.type === "scheduled";

              return (
                <details
                  key={record.id}
                  className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <summary className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${isScheduled ? "bg-blue-50 dark:bg-blue-950" : "bg-indigo-50 dark:bg-indigo-950"}`}>
                        {isScheduled ? (
                          <CalendarClock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Mail className="h-4 w-4 text-indigo-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {subject}
                          </p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {isScheduled ? "Scheduled" : "Sent"} by {senderName} · {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 pl-11 sm:pl-0 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(record.createdAt)}
                        </div>
                        {isScheduled && record.targetAt && (
                          <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                            <CalendarClock className="h-3 w-3" />
                            Target: {formatDateTime(record.targetAt)}
                          </div>
                        )}
                      </div>
                      {(record.details?.sentCount as number) != null && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          {record.details?.sentCount as number} sent
                          {(record.details?.failedCount as number) ? `, ${record.details?.failedCount} failed` : ""}
                        </span>
                      )}
                      <svg
                        className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="px-4 sm:px-6 pb-4 pt-1 space-y-3">
                    {record.recipients.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Users className="h-3.5 w-3.5 text-gray-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Recipients ({record.recipients.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {record.recipients.map((r, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-2.5 py-1 text-gray-700 dark:text-gray-300"
                            >
                              {r.name || r.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {message || "No message content"}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
  );
}

export default function EmailRecordsPage() {
  return (
    <StaffOnly>
      <EmailRecordsPageContent />
    </StaffOnly>
  );
}
