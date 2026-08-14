"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  message: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "assignment", label: "Assignment" },
  { value: "grade", label: "Grade" },
  { value: "announcement", label: "Announcement" },
  { value: "reminder", label: "Reminder" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  assignment: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  grade: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  announcement: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  reminder: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EmailTemplatesPageContent() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/email-templates")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormSubject("");
    setFormMessage("");
    setFormCategory("general");
    setDialogOpen(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormMessage(template.message);
    setFormCategory(template.category);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim() || !formMessage.trim()) return;
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/email-templates/${editingId}`
        : "/api/admin/email-templates";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          subject: formSubject.trim(),
          message: formMessage.trim(),
          category: formCategory,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        fetchTemplates();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTemplates();
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const filtered =
    filter === "ALL"
      ? templates
      : templates.filter((t) => t.category === filter);

  if (loading) {
    return <LoadingSpinner message="Loading email templates..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Email Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create reusable templates for notifications and emails ({templates.length} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </div>
      </div>

      {/* Category stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { key: "ALL", label: "All", count: templates.length },
          ...CATEGORIES.map((c) => ({
            key: c.value,
            label: c.label,
            count: templates.filter((t) => t.category === c.value).length,
          })),
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-2 rounded-xl text-center text-xs font-medium border transition-colors ${
              filter === key
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800"
            }`}
          >
            <span className="block text-lg font-bold">{count}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Template list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description={
            filter === "ALL"
              ? "Create your first email template to speed up notifications."
              : `No ${filter} templates found.`
          }
        >
          {filter === "ALL" && (
            <Button
              size="sm"
              onClick={openCreate}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white mt-3"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Template
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {template.subject}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase shrink-0 ${
                    CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general
                  }`}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {template.category}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed whitespace-pre-wrap flex-1">
                {template.message}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  By {template.createdBy.name || template.createdBy.email} · {formatDate(template.updatedAt)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-indigo-600"
                    onClick={() => openEdit(template)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                    onClick={() => setDeleteId(template.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              {editingId ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the template details below."
                : "Create a reusable template for emails and notifications."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  placeholder="e.g. Assignment Published"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Category</Label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Subject</Label>
              <Input
                placeholder="Email subject line"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Message</Label>
              <Textarea
                placeholder="Email body content..."
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                rows={6}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formSubject.trim() || !formMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              This will permanently remove the template. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EmailTemplatesPage() {
  return (
    <StaffOnly minRole="PROFESSOR">
      <EmailTemplatesPageContent />
    </StaffOnly>
  );
}
