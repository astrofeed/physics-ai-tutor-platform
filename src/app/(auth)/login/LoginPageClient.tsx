"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Atom, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginPageClient({
  googleEnabled,
  initialError,
}: {
  googleEnabled: boolean;
  initialError: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md mx-4 px-1">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 dark:bg-gray-100 mb-4">
            <Atom className="h-6 w-6 text-white dark:text-gray-900" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            PhysTutor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Master Physics with AI
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Welcome back
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Sign in to continue your learning journey
            </p>
          </div>

          {googleEnabled && <GoogleSignInButton label="Sign in with Google (NTHU)" />}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2 ${shakeError ? "animate-auth-shake" : ""}`}>
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm ${error ? "border-red-300 dark:border-red-700 focus-visible:ring-red-300 dark:focus-visible:ring-red-700 focus-visible:border-red-300 dark:focus-visible:border-red-700" : ""}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm ${error ? "border-red-300 dark:border-red-700 focus-visible:ring-red-300 dark:focus-visible:ring-red-700 focus-visible:border-red-300 dark:focus-visible:border-red-700" : ""}`}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-lg bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium transition-colors text-sm"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sign In
              {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
