"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface HowToStep {
  title: string;
  detail: string;
}

export interface HowToFaq {
  q: string;
  a: string;
}

interface HowToCardProps {
  title: string;
  /** localStorage key remembering that the grader hid the card. */
  storageKey: string;
  steps: HowToStep[];
  faq: HowToFaq[];
}

/** Step-by-step instructions and FAQ for TAs; stays open until dismissed. */
export function HowToCard({ title, storageKey, steps, faq }: HowToCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) === "1") setCollapsed(true);
  }, [storageKey]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(storageKey, next ? "1" : "0");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-gray-500" />
            {title}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={!collapsed}>
            {collapsed ? "Show" : "Hide"}
            {collapsed ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-gray-500">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="space-y-3">
            {faq.map((item) => (
              <div key={item.q}>
                <dt className="font-medium">{item.q}</dt>
                <dd className="text-gray-500">{item.a}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}
