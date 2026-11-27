"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ReportLeaveGuard() {
  const router = useRouter();
  const [destination, setDestination] = useState<URL | null>(null);

  useEffect(() => {
    const dirty = () => document.querySelector('[data-unsaved-review="true"]') !== null;
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty()) { event.preventDefault(); event.returnValue = ""; }
    };
    const follow = (event: MouseEvent) => {
      if (!dirty() || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(url);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", follow, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", follow, true);
    };
  }, []);
  return (
    <AlertDialog open={!!destination} onOpenChange={(open) => { if (!open) setDestination(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>Your latest score or comment has not been submitted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep grading</AlertDialogCancel>
          <AlertDialogAction onClick={() => destination && router.push(destination.pathname + destination.search + destination.hash)}>
            Leave without saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
