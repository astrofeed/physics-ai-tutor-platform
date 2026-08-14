"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LogOut,
  ChevronRight,
  User,
  Settings,
  Loader2,
  ShieldAlert,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isStaff as isStaffRole } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NotifyUsersDialog, type NotifySendContext } from "@/components/ui/notify-users-dialog";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";

interface TopbarProps {
  userName: string;
  userEmail: string;
  userImage?: string;
  userRole: string;
  onMobileMenuToggle?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdByName: string | null;
  createdAt: string;
  isRead: boolean;
}

interface ScheduledNotificationItem {
  id: string;
  title: string;
  message: string;
  createdByName: string | null;
  createdAt: string;
  isRead: boolean;
  isScheduled: boolean;
  scheduledAt: string;
  hasEmail: boolean;
}

const routeLabels: Record<string, string> = {
  "/dashboard": "Home",
  "/chat": "AI Chat",
  "/assignments": "Assignments",
  "/assignments/create": "Create Assignment",
  "/grades": "Grades",
  "/problems/generate": "Problem Generator",
  "/grading": "Grading",
  "/admin/users": "Users",
  "/admin/email-records": "Email Records",
  "/admin/email-templates": "Email Templates",
  "/admin/scheduled-emails": "Scheduled Emails",
  "/admin/qa-history": "Q&A History",
  "/admin/settings": "Settings",
  "/profile": "Profile",
  "/settings": "Settings",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Topbar({ userName, userEmail, userImage, userRole, onMobileMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<"notifications" | "scheduled">("notifications");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null);
  const [examModeActive, setExamModeActive] = useState(false);
  const [examModeMessage, setExamModeMessage] = useState<string | null>(null);
  const [examTooltipOpen, setExamTooltipOpen] = useState(false);
  const [examToggling, setExamToggling] = useState(false);
  const [examConfirmOpen, setExamConfirmOpen] = useState(false);

  const isStaff = isStaffRole(userRole);

  const fetchExamMode = useCallback(async () => {
    try {
      const res = await fetch("/api/exam-mode");
      if (res.ok) {
        const data = await res.json();
        setExamModeActive(data.isActive);
        setExamModeMessage(data.message);
      }
    } catch (err) {
      console.error("[Topbar] Failed to fetch exam mode", err);
    }
  }, []);

  const toggleExamMode = async () => {
    setExamToggling(true);
    try {
      const res = await fetch("/api/exam-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !examModeActive }),
      });
      if (res.ok) {
        const data = await res.json();
        setExamModeActive(data.isActive);
        setExamModeMessage(data.message);
      }
    } finally {
      setExamToggling(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data ?? []);
        setUnreadCount(data.unreadCount ?? 0);
        setScheduledNotifications(data.scheduledItems ?? []);
      }
    } catch (err) {
      console.error("[Topbar] Failed to fetch notifications", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchExamMode();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchExamMode();
    }, 60000);
    const handleRefetch = () => fetchNotifications();
    window.addEventListener("refetch-notifications", handleRefetch);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refetch-notifications", handleRefetch);
    };
  }, [fetchNotifications, fetchExamMode]);

  const handleDropdownOpen = (open: boolean) => {
    setNotifOpen(open);
    if (open) fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAsUnread = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "DELETE" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
    );
    setUnreadCount((prev) => prev + 1);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const openCreateDialog = () => {
    setNotifOpen(false);
    setNotifyDialogOpen(true);
  };

  const openEditDialog = (n: NotificationItem) => {
    setEditingId(n.id);
    setTitle(n.title);
    setMessage(n.message);
    setNotifOpen(false);
    setDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingId || !title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/notifications/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), message: message.trim() }),
      });
      if (res.ok) {
        setTitle("");
        setMessage("");
        setEditingId(null);
        setDialogOpen(false);
        fetchNotifications();
      }
    } finally {
      setSending(false);
    }
  };

  const handleCreateAnnouncement = async (
    subject: string,
    msg: string,
    { audienceRoles }: NotifySendContext
  ) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: subject, message: msg, audienceRoles }),
    });
    fetchNotifications();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchNotifications();
    }
  };

  // Fetch dynamic breadcrumb label for detail pages (e.g., assignment title)
  useEffect(() => {
    const match = pathname.match(/^\/assignments\/([a-z0-9]{20,})$/i);
    if (match) {
      fetch(`/api/assignments/${match[1]}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.assignment?.title) setDynamicLabel(data.assignment.title);
          else setDynamicLabel(null);
        })
        .catch((err) => { console.error("[Topbar] Failed to fetch breadcrumb label:", err); setDynamicLabel(null); });
    } else {
      setDynamicLabel(null);
    }
  }, [pathname]);

  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];

    let currentPath = "";
    for (const segment of segments) {
      currentPath += `/${segment}`;
      // For database IDs, show the dynamic label if available
      if (/^[a-z0-9]{20,}$/i.test(segment) || /^[0-9a-f]{8}-/.test(segment)) {
        if (dynamicLabel) {
          crumbs.push({ label: dynamicLabel, href: currentPath });
        }
        continue;
      }
      const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
      crumbs.push({ label, href: currentPath });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile sidebar toggle */}
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
            <Link
              href="/dashboard"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors shrink-0 hidden sm:inline"
            >
              PhysTutor
            </Link>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.href}>
                <ChevronRight className={`h-3.5 w-3.5 text-gray-300 dark:text-gray-600 shrink-0 ${i === 0 ? 'hidden sm:block' : ''}`} />
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors shrink-0"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Exam Mode Badge */}
          {examModeActive && (
            <div className="relative">
              <button
                onClick={() => {
                  if (isStaff) {
                    toggleExamMode();
                  } else {
                    setExamTooltipOpen(!examTooltipOpen);
                  }
                }}
                disabled={examToggling}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                title="Exam Mode Active"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Exam Mode</span>
                {isStaff && (
                  <span className="hidden sm:inline text-[10px] text-red-400 ml-0.5">(click to turn off)</span>
                )}
              </button>
              {examTooltipOpen && !isStaff && (
                <div className="absolute top-full right-0 mt-1.5 w-64 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-3 z-50">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Exam Mode is Active</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {examModeMessage || "An exam is in progress. The AI tutor will provide guidance and help you understand concepts, but will not give direct answers to problems."}
                  </p>
                  <button
                    onClick={() => setExamTooltipOpen(false)}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Exam Mode Toggle for Staff (when not active) */}
          {!examModeActive && isStaff && (
            <button
              onClick={() => setExamConfirmOpen(true)}
              disabled={examToggling}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              title="Enable Exam Mode"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Exam Mode</span>
            </button>
          )}

          <NotificationDropdown
            notifications={notifications}
            scheduledNotifications={scheduledNotifications}
            unreadCount={unreadCount}
            isOpen={notifOpen}
            onOpenChange={handleDropdownOpen}
            notifTab={notifTab}
            onTabChange={setNotifTab}
            isStaff={isStaff}
            onMarkAsRead={markAsRead}
            onMarkAsUnread={markAsUnread}
            onMarkAllRead={markAllRead}
            onCreateAnnouncement={openCreateDialog}
            onEdit={openEditDialog}
            onDelete={handleDelete}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative flex items-center gap-2 rounded-lg pl-2 pr-3 h-9 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={userImage} alt={userName} />
                  <AvatarFallback className="text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {userName?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {userName}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-gray-400 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-lg p-1.5" align="end" sideOffset={8}>
              <DropdownMenuLabel className="font-normal px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={userImage} alt={userName} />
                    <AvatarFallback className="text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {userName?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>
                    <span className="mt-0.5 inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide w-fit">
                      {userRole}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              <Link href="/profile">
                <DropdownMenuItem className="cursor-pointer rounded-md px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  <User className="mr-2.5 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
              </Link>
              <Link href="/settings">
                <DropdownMenuItem className="cursor-pointer rounded-md px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  <Settings className="mr-2.5 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50 transition-colors"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="notif-title">Title</Label>
              <Input
                id="notif-title"
                placeholder="e.g. Exam reminder"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-message">Message</Label>
              <Textarea
                id="notif-message"
                placeholder="Write your announcement..."
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={sending || !title.trim() || !message.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotifyUsersDialog
        open={notifyDialogOpen}
        onOpenChange={setNotifyDialogOpen}
        defaultSubject=""
        defaultMessage=""
        onBeforeSend={handleCreateAnnouncement}
        onSent={() => fetchNotifications()}
        dialogTitle="New Announcement"
        dialogDescription="Create an announcement and email selected users."
        sendButtonLabel="Send Announcement"
        successMessage="Announcement sent successfully"
      />

      <AlertDialog open={examConfirmOpen} onOpenChange={setExamConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Exam Mode?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Exam Mode restricts the AI tutor for all students. While active:
              </span>
              <span className="block pl-4">
                • The AI will only provide guided hints, not direct answers
              </span>
              <span className="block pl-4">
                • Students will see an &quot;Exam Mode Active&quot; indicator
              </span>
              <span className="block pl-4">
                • You can turn it off at any time from the top bar
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleExamMode()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <ShieldAlert className="h-4 w-4 mr-1.5" />
              Enable Exam Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
