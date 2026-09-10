"use client";

import React from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  revealed: boolean;
  revealing: boolean;
  onReveal: () => void;
  children: React.ReactNode;
}

/**
 * Keeps the AI result folded until staff either save their own scores or
 * explicitly open it; the reveal is timestamped server-side either way.
 */
export function AiResultGate({ revealed, revealing, onReveal, children }: Props) {
  if (revealed) return <>{children}</>;
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-gray-500">
          The AI result is hidden until you save your own scores above.
          <br />
          Opening it first is fine, but the grade will be recorded as AI-informed.
        </p>
        <Button variant="outline" size="sm" onClick={onReveal} disabled={revealing}>
          {revealing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="mr-1.5 h-3.5 w-3.5" />
          )}
          Show AI result anyway
        </Button>
      </CardContent>
    </Card>
  );
}
