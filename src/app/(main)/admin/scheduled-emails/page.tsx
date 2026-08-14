"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState, useCallback } from "react";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
  RefreshCw,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ScheduledEmail {
  id: string;
  subject: string;
  message: string;
  scheduledAt: string;
  recipientIds: string[];
  status: "PENDING" | "SENT" | "CANCELLED" | "FAILED";
  createNotification: boolean;
  sentAt: string | null;
  cancelledAt: string | null;
  error: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  SENT: {
    label: "Sent",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: Ban,
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-800",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
  },
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "overdue";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

function ScheduledEmailsPageContent() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const fetchEmails = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/scheduled-emails")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setEmails(data.scheduledEmails || []);
      })
      .catch(() => setEmails([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleCancel = async () => {
    if (!cancelId) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/scheduled-emails/${cancelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        fetchEmails();
      }
    } finally {
      setActing(false);
      setCancelId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/scheduled-emails/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEmails();
      }
    } finally {
      setActing(false);
      setDeleteId(null);
    }
  };

  const filtered =
    filter === "ALL" ? emails : emails.filter((e) => e.status === filter);

  const pendingCount = emails.filter((e) => e.status === "PENDING").length;
  const sentCount = emails.filter((e) => e.status === "SENT").length;
  const cancelledCount = emails.filter((e) => e.status === "CANCELLED").length;
  const failedCount = emails.filter((e) => e.status === "FAILED").length;

  if (loading) {
    return <LoadingSpinner message="Loading scheduled emails..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Scheduled Emails
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage scheduled email notifications ({emails.length} total)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEmails}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending", count: pendingCount, icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" },
          { label: "Sent", count: sentCount, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950" },
          { label: "Cancelled", count: cancelledCount, icon: Ban, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800" },
          { label: "Failed", count: failedCount, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950" },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${bg}`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {label}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {count}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: "ALL", label: `All (${emails.length})` },
          { key: "PENDING", label: `Pending (${pendingCount})` },
          { key: "SENT", label: `Sent (${sentCount})` },
          { key: "CANCELLED", label: `Cancelled (${cancelledCount})` },
          { key: "FAILED", label: `Failed (${failedCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === key
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Email list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled emails"
          description={
            filter === "ALL"
              ? "Schedule emails from the notification dialog when sending announcements or assignment notifications."
              : `No ${filter.toLowerCase()} scheduled emails.`
          }
        />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {filtered.map((email) => {
            const statusConfig = STATUS_CONFIG[email.status];
            const StatusIcon = statusConfig.icon;

            return (
              <details
                key={email.id}
                className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <summary className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${statusConfig.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {email.subject}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        By {email.createdBy.name || email.createdBy.email} ·{" "}
                        {(email.recipientIds as string[]).length} recipient
                        {(email.recipientIds as string[]).length !== 1 ? "s" : ""}
                        {email.createNotification && (
                          <span className="ml-1.5 text-indigo-500">+ notification</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pl-11 sm:pl-0 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {formatDateTime(email.scheduledAt)}
                      </p>
                      {email.status === "PENDING" && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          {timeUntil(email.scheduledAt)}
                        </p>
                      )}
                      {email.status === "SENT" && email.sentAt && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Sent {formatDateTime(email.sentAt)}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusConfig.bg} ${statusConfig.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>

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
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {email.message}
                  </div>

                  {email.error && (
                    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-300">{email.error}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>Created {formatDateTime(email.createdAt)}</span>
                    {email.cancelledAt && (
                      <span>· Cancelled {formatDateTime(email.cancelledAt)}</span>
                    )}
                  </div>

                  {email.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={(e) => {
                          e.preventDefault();
                          setCancelId(email.id);
                        }}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {(email.status === "CANCELLED" || email.status === "SENT" || email.status === "FAILED") && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteId(email.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Scheduled Email?</DialogTitle>
            <DialogDescription>
              This email will not be sent. You can delete it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)} disabled={acting}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={acting}
            >
              {acting ? "Cancelling..." : "Cancel Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Scheduled Email?</DialogTitle>
            <DialogDescription>
              This will permanently remove the record. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={acting}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={acting}
            >
              {acting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ScheduledEmailsPage() {
  return (
    <StaffOnly minRole="PROFESSOR">
      <ScheduledEmailsPageContent />
    </StaffOnly>
  );
}
