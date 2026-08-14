"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function AdminSettingsPageContent() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-5.2");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setProvider(data.config.provider || "openai");
          setModel(data.config.model || "gpt-5.2");
          setSystemPrompt(data.config.systemPrompt || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, systemPrompt }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400 dark:text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Settings</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Configure AI provider and system behavior
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>
            Choose which AI provider to use for chat and grading
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {provider === "openai" ? (
                    <>
                      <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="claude-haiku-4-5-20251001">
                        Claude 4.5 Haiku
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            Customize the AI tutor&apos;s behavior and personality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful physics tutor for university-level General Physics students..."
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
            Leave blank to use the default physics tutor prompt.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-8">
        {saved && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Settings saved!
          </div>
        )}
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <StaffOnly minRole="PROFESSOR">
      <AdminSettingsPageContent />
    </StaffOnly>
  );
}
