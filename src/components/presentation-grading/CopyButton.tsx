"use client";

import React, { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="mr-1.5 h-4 w-4" /> : <ClipboardCopy className="mr-1.5 h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
