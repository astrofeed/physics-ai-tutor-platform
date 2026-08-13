"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/utils";

interface OpenAppeal {
  id: string;
  studentName: string;
  assignmentTitle: string;
  assignmentId: string;
  status: string;
  createdAt: string;
}

interface UpcomingAssignment {
  id: string;
  title: string;
  dueDate: string | null;
  type: string;
}

function CardShell({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-minimal animate-fade-in" style={{ animationDelay: "100ms" }}>
      <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
        <h3 className="section-title">{title}</h3>
        <Link
          href={href}
          className="flex items-center gap-1 text-caption font-medium text-primary hover:underline"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function EmptyNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="py-6">
      <p className="text-body text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 text-caption text-muted-foreground">{detail}</p>
    </div>
  );
}

interface OpenAppealsCardProps {
  appeals: OpenAppeal[];
}

export function OpenAppealsCard({ appeals }: OpenAppealsCardProps) {
  return (
    <CardShell title="Open appeals" href="/grading">
      {appeals.length === 0 ? (
        <EmptyNote title="No open appeals" detail="Every grade appeal has been resolved." />
      ) : (
        <div className="divide-y divide-border" role="list" aria-label="Open appeals">
          {appeals.map((appeal) => (
            <Link
              key={appeal.id}
              href={`/assignments/${appeal.assignmentId}`}
              className="-mx-2 flex items-baseline gap-4 px-2 py-3 transition-colors first:pt-0 hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-gray-900 dark:text-gray-100">
                  {appeal.studentName}
                </p>
                <p className="mt-0.5 truncate text-caption text-muted-foreground">
                  {appeal.assignmentTitle}
                </p>
              </div>
              <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                {formatShortDate(appeal.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </CardShell>
  );
}

interface UpcomingAssignmentsCardProps {
  assignments: UpcomingAssignment[];
}

export function UpcomingAssignmentsCard({ assignments }: UpcomingAssignmentsCardProps) {
  return (
    <CardShell title="Upcoming assignments" href="/assignments">
      {assignments.length === 0 ? (
        <EmptyNote
          title="No upcoming assignments"
          detail="Nothing is due. New work will appear here."
        />
      ) : (
        <div className="divide-y divide-border" role="list" aria-label="Upcoming assignments">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/assignments/${assignment.id}`}
              className="-mx-2 flex items-baseline gap-4 px-2 py-3 transition-colors first:pt-0 hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-gray-900 dark:text-gray-100">
                  {assignment.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-caption font-normal">
                    {assignment.type === "QUIZ" ? "Quiz" : "File upload"}
                  </Badge>
                  {assignment.dueDate && (
                    <span className="text-caption text-muted-foreground">
                      Due {formatShortDate(assignment.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CardShell>
  );
}
