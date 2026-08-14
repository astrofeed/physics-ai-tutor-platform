"use client";

import { useEffect, useState } from "react";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  message: string;
  category: string;
}

export function useEmailTemplates(open: boolean) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/admin/email-templates")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load templates"))))
      .then((data: { templates?: EmailTemplate[] }) => setTemplates(data.templates || []))
      .catch((error: unknown) => {
        console.error("Failed to load email templates:", error);
        setTemplates([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  return { templates, loading };
}
