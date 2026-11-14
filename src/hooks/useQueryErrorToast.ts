"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Logs a failed query and tells the user once per error. */
export function useQueryErrorToast(error: Error | null, message: string) {
  useEffect(() => {
    if (!error) return;
    console.error("[query]", { message, error });
    toast.error(message);
  }, [error, message]);
}
