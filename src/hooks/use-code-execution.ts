"use client";

import { useEffect, useState } from "react";

/**
 * Shared across every code block on the page: one request per page load
 * instead of one per rendered block.
 */
let availability: Promise<boolean> | null = null;

function fetchAvailability(): Promise<boolean> {
  availability ??= fetch("/api/run-code")
    .then((res) => (res.ok ? res.json() : { enabled: false }))
    .then((data: { enabled?: boolean }) => data.enabled === true)
    .catch(() => false);

  return availability;
}

/** Whether a code sandbox is configured, i.e. whether Run buttons should show. */
export function useCodeExecutionAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let current = true;
    fetchAvailability().then((enabled) => {
      if (current) setAvailable(enabled);
    });
    return () => {
      current = false;
    };
  }, []);

  return available;
}
