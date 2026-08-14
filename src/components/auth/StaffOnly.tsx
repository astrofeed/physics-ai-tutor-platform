"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffectiveSession } from "@/lib/effective-session-context";
import { isStaff as isStaffRole, ROLE_HIERARCHY } from "@/lib/constants";
import type { UserRole } from "@/types";

/**
 * Page-level guard for staff pages, so students get an explicit denial instead
 * of an empty shell whose API calls all fail. API routes still enforce their own
 * authorization.
 */
export function StaffOnly({
  children,
  minRole,
}: {
  children: React.ReactNode;
  minRole?: UserRole;
}) {
  const session = useEffectiveSession();
  const allowed = minRole
    ? ROLE_HIERARCHY[session.role] >= ROLE_HIERARCHY[minRole]
    : isStaffRole(session.role);

  if (allowed) return <>{children}</>;

  return (
    <div className="max-w-md mx-auto text-center py-20 space-y-4">
      <ShieldAlert className="h-10 w-10 mx-auto text-neutral-400" />
      <h1 className="text-lg font-semibold">This page is for course staff</h1>
      <p className="text-sm text-neutral-500">
        Your account does not have access to it.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">Back to dashboard</Button>
      </Link>
    </div>
  );
}
