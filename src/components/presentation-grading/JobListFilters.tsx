"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_GROUPS = "all";

export interface JobListFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Group numbers on the sign-up sheet; the Group menu is hidden while empty. */
  groupNumbers: number[];
  group: number | null;
  onGroupChange: (group: number | null) => void;
}

/** Narrows a results list to one sign-up sheet group; the options are the groups on the sheet. */
function GroupSelect({
  groupNumbers,
  value,
  onChange,
}: {
  groupNumbers: number[];
  value: number | null;
  onChange: (group: number | null) => void;
}) {
  if (groupNumbers.length === 0) return null;
  return (
    <Select
      value={value === null ? ALL_GROUPS : String(value)}
      onValueChange={(next) => onChange(next === ALL_GROUPS ? null : Number(next))}
    >
      <SelectTrigger className="w-full sm:w-36" aria-label="Filter by group">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
        {groupNumbers.map((number) => (
          <SelectItem key={number} value={String(number)}>
            Group {number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Group menu plus free-text search for the report / presentation results lists. */
export function JobListFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  groupNumbers,
  group,
  onGroupChange,
}: JobListFilterProps & { searchPlaceholder: string; searchLabel: string }) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <GroupSelect groupNumbers={groupNumbers} value={group} onChange={onGroupChange} />
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8 pr-8"
          aria-label={searchLabel}
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
