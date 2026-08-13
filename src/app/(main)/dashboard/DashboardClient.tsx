"use client";

import React from "react";
import Link from "next/link";
import {
  MessageSquare,
  FileText,
  Sparkles,
  Upload,
  PenTool,
  ClipboardList,
} from "lucide-react";
import { isStaff } from "@/lib/constants";
import { StatBand, type StatItem } from "@/components/ui/stat-band";
import { RecentConversationsCard } from "@/components/dashboard/RecentConversationsCard";
import { OpenAppealsCard, UpcomingAssignmentsCard } from "@/components/dashboard/ActivityCards";

interface DashboardClientProps {
  userName: string;
  userRole: string;
  date: string;
  stats: {
    conversationCount: number;
    assignmentCount: number;
    submissionCount: number;
  };
  adminStats: {
    totalUsers: number;
    totalConversations: number;
    totalSubmissions: number;
  } | null;
  taStats: {
    pendingGrading: number;
    createdAssignments: number;
    openAppealCount: number;
  } | null;
  recentConversations: {
    id: string;
    title: string;
    updatedAt: string;
    lastMessage: string;
  }[];
  upcomingAssignments: {
    id: string;
    title: string;
    dueDate: string | null;
    type: string;
  }[];
  openAppeals?: {
    id: string;
    studentName: string;
    assignmentTitle: string;
    assignmentId: string;
    status: string;
    createdAt: string;
  }[];
}

function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="section-rule mb-4">
      <span className="section-index">{index}</span>
      <h2 className="eyebrow shrink-0">{title}</h2>
    </div>
  );
}

export default function DashboardClient({
  userName,
  userRole,
  date,
  stats,
  adminStats,
  taStats,
  recentConversations,
  upcomingAssignments,
  openAppeals = [],
}: DashboardClientProps) {
  const isStaffRole = isStaff(userRole);
  const quickStartItems = [
    {
      icon: MessageSquare,
      label: "Ask AI",
      description: "Chat with your AI physics tutor",
      href: "/chat",
      roles: ["STUDENT", "TA", "PROFESSOR", "ADMIN"],
    },
    {
      icon: FileText,
      label: "Assignments",
      description: "View and complete assignments",
      href: "/assignments",
      roles: ["STUDENT", "TA", "PROFESSOR", "ADMIN"],
    },
    {
      icon: Upload,
      label: "Submit Work",
      description: "Upload your homework solutions",
      href: "/assignments",
      roles: ["STUDENT"],
    },
    {
      icon: Sparkles,
      label: "Generate Problems",
      description: "Create problems with AI assistance",
      href: "/problems/generate",
      roles: ["TA", "PROFESSOR", "ADMIN"],
    },
    {
      icon: PenTool,
      label: "Create Assignment",
      description: "Design a new assignment for students",
      href: "/assignments/create",
      roles: ["TA", "PROFESSOR", "ADMIN"],
    },
    {
      icon: ClipboardList,
      label: "Grading",
      description: "Review and grade submissions",
      href: "/grading",
      roles: ["TA", "PROFESSOR", "ADMIN"],
    },
  ];

  const filteredQuickStart = quickStartItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const statItems: StatItem[] = (() => {
    if (userRole === "ADMIN" && adminStats) {
      return [
        { value: adminStats.totalUsers, label: "Users", href: "/admin/users" },
        { value: adminStats.totalConversations, label: "Conversations", href: "/admin/qa-history" },
        { value: adminStats.totalSubmissions, label: "Submissions", href: "/assignments" },
      ];
    }
    if ((userRole === "TA" || userRole === "PROFESSOR") && taStats) {
      return [
        { value: stats.conversationCount, label: "My chats", href: "/chat" },
        { value: taStats.pendingGrading, label: "Pending grading", href: "/grading" },
        { value: taStats.openAppealCount, label: "Open appeals", href: "/grading" },
      ];
    }
    return [
      { value: stats.conversationCount, label: "Questions asked", href: "/chat" },
      { value: stats.assignmentCount, label: "Assignments", href: "/assignments" },
      { value: stats.submissionCount, label: "Submissions", href: "/grades" },
    ];
  })();

  return (
    <div className="page-sections pb-8">
      <div className="page-header">
        <p className="eyebrow-signal">{date}</p>
        <h1 className="page-title">Good to see you, {userName}</h1>
      </div>

      <StatBand items={statItems} />

      <div>
        <SectionHeading index="01" title="Jump back in" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {filteredQuickStart.slice(0, 6).map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="flex items-start gap-3 bg-card px-4 py-3.5 hover:bg-secondary/60 transition-colors"
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              <div>
                <p className="text-body font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading index="02" title="Recent activity" />
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
          <RecentConversationsCard conversations={recentConversations} />
          {isStaffRole ? (
            <OpenAppealsCard appeals={openAppeals} />
          ) : (
            <UpcomingAssignmentsCard assignments={upcomingAssignments} />
          )}
        </div>
      </div>
    </div>
  );
}
