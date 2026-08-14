"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Atom, ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "verifying" | "verified" | "failed" | "missing";

function VerifyEmailCard() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "missing");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setStatus("verified");
        } else {
          setError(data.error || "Verification failed.");
          setStatus("failed");
        }
      } catch {
        if (cancelled) return;
        setError("Something went wrong. Please try again.");
        setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResent(true);
      } else {
        setError(data.error || "Could not send a new link.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (status === "verifying") {
    return (
      <div className="text-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Verifying your email…</p>
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Email verified</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          Your account is active. Sign in to start using the tutor.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        {status === "failed" ? (
          <XCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        ) : null}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {status === "failed" ? "Link not valid" : "Verify your email"}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {status === "failed"
            ? error
            : "Enter your address and we'll send a new verification link."}
        </p>
      </div>

      {resent ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          If that address needs verification, a new link is on its way. The link expires in 24 hours.
        </p>
      ) : (
        <form onSubmit={handleResend} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border-gray-200 dark:border-gray-700 text-sm"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 rounded-lg bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium text-sm"
            disabled={resending}
          >
            {resending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Send New Link
          </Button>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md mx-4 px-1">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 dark:bg-gray-100 mb-4">
            <Atom className="h-6 w-6 text-white dark:text-gray-900" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            PhysTutor
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
          <Suspense
            fallback={<Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />}
          >
            <VerifyEmailCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
