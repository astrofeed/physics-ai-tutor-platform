"use client";

import { useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

export interface ScoreDraft {
  mode: "total" | "items";
  itemDraft: Record<string, string>;
  totalDraft: string;
  comments: string;
}

// Keep unfinished grades in memory only, scoped to the signed-in grader.
const drafts = new WeakMap<QueryClient, Map<string, ScoreDraft>>();

export function useScoreDraftCache() {
  const client = useQueryClient();
  let cache = drafts.get(client);
  if (!cache) {
    cache = new Map();
    drafts.set(client, cache);
  }
  return cache;
}

export function useScoreDraft(initial: ScoreDraft, key?: string) {
  const cache = useScoreDraftCache();
  const [baseline] = useState(initial);
  const [draft, setDraft] = useState(() => (key && cache.get(key)) || initial);
  function change(patch: Partial<ScoreDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!key) return;
    if (JSON.stringify(next) === JSON.stringify(baseline)) cache.delete(key);
    else cache.set(key, next);
  }
  return { draft, change, dirty: !!key && cache.has(key), clear: () => key && cache.delete(key) };
}
