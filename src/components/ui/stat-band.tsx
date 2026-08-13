import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}

const COLUMN_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
};

function Figure({ label, value, hint }: StatItem) {
  return (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </>
  );
}

export function StatBand({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div className={cn("stat-band", COLUMN_CLASS[items.length] ?? "grid-cols-2 sm:grid-cols-4", className)}>
      {items.map((item) =>
        item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="bg-card px-4 py-4 sm:px-5 hover:bg-secondary/60 transition-colors"
          >
            <Figure {...item} />
          </Link>
        ) : (
          <div key={item.label} className="bg-card px-4 py-4 sm:px-5">
            <Figure {...item} />
          </div>
        )
      )}
    </div>
  );
}
