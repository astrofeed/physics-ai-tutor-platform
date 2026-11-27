"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportJobNavigation } from "@/lib/report-grading";

interface Props {
  navigation: ReportJobNavigation | null | undefined;
}

/**
 * Queue navigation placed right below the grading form so staff can jump
 * directly to the previous, next, or next ungraded report without going back
 * to the list page.
 */
export function ReportGradingNavBar({ navigation }: Props) {
  if (!navigation || navigation.totalDone === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/70 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {navigation.position !== null
            ? `Report ${navigation.position} of ${navigation.totalDone}`
            : `${navigation.totalDone} graded reports`}
        </span>
        <span className="tabular-nums">
          You graded {navigation.myGradedDone} / {navigation.totalDone}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {navigation.prevId ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/report-grading/${navigation.prevId}`}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Previous
            </Button>
          )}

          {navigation.nextId ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/report-grading/${navigation.nextId}`}>
                Next
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {navigation.nextCompletelyUngradedId &&
          navigation.nextCompletelyUngradedId !== navigation.nextUngradedId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/report-grading/${navigation.nextCompletelyUngradedId}`}>
                Next with no scores
              </Link>
            </Button>
          ) : null}

          {navigation.nextUngradedId ? (
            <Button size="sm" asChild>
              <Link href={`/report-grading/${navigation.nextUngradedId}`}>
                <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                Next ungraded
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              All graded by you
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
