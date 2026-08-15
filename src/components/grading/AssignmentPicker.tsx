"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AssignmentOption } from "@/components/grading/types";

type PickerFilter = "all" | "ungraded" | "pending";

const FILTERS: { key: PickerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ungraded", label: "Ungraded" },
  { key: "pending", label: "Appeals" },
];

interface AssignmentPickerProps {
  assignments: AssignmentOption[];
  selectedAssignmentId: string;
  onSelect: (assignmentId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function AssignmentPicker({
  assignments,
  selectedAssignmentId,
  onSelect,
  page,
  totalPages,
  onPageChange,
}: AssignmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PickerFilter>("all");

  const visible = assignments.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "ungraded" && a.ungradedCount <= 0) return false;
    if (filter === "pending" && a.openAppealCount <= 0) return false;
    return true;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex h-10 w-full sm:w-96 items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
          <span
            className={
              selectedAssignmentId
                ? "text-gray-900 dark:text-gray-100 font-medium truncate"
                : "text-gray-400 dark:text-gray-500"
            }
          >
            {assignments.find((a) => a.id === selectedAssignmentId)?.title ||
              "Select an assignment to grade"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="sm:w-96 p-0">
        <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search assignments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 p-2 border-b border-neutral-100 dark:border-neutral-800">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                onPageChange(1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f.key
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 ? (
            <div className="px-3 py-6 text-sm text-gray-400 text-center">
              No matching assignments
            </div>
          ) : (
            visible.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  onSelect(a.id);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                  a.id === selectedAssignmentId
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {a.title}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                  <span>{a.submissionCount} submissions</span>
                  {a.ungradedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      {a.ungradedCount} ungraded
                    </span>
                  )}
                  {a.openAppealCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                      {a.openAppealCount} appeal{a.openAppealCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center px-3 py-2 border-t border-neutral-100 dark:border-neutral-800">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
