"use client";

import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GRADING_SHORTCUTS } from "@/hooks/useGradingShortcuts";

export function GradingShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 dark:text-gray-400">
          <Keyboard className="h-4 w-4" />
          <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grading shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2">
          {GRADING_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-baseline gap-3">
              <dt className="shrink-0 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                {shortcut.keys}
              </dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400">
                {shortcut.description}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
