"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Atom, Mail, Lock, User, Loader2, ArrowRight, ArrowLeft, IdCard, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function RegisterPageClient({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const [registered, setRegistered] = useState(false);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const triggerError = (message: string) => {
    setError(message);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      triggerError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      triggerError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      triggerError("Password must contain uppercase, lowercase, and a number");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, studentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        triggerError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      setRegistered(true);
      setLoading(false);
    } catch {
      triggerError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md mx-4 px-1 py-8">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 dark:bg-gray-100 mb-4">
            <Atom className="h-6 w-6 text-white dark:text-gray-900" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            PhysTutor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Start Your Physics Journey
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
          {registered ? (
            <div className="text-center">
              <MailCheck className="h-10 w-10 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Verify your email
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                We sent a verification link to <span className="font-medium">{email}</span>. Open it
                to activate your account — the link expires in 24 hours.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
          <>
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Create an account
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Join PhysTutor and start mastering physics
            </p>
          </div>

          {googleEnabled && <GoogleSignInButton label="Sign up with Google (NTHU)" />}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2 ${shakeError ? "animate-auth-shake" : ""}`}>
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="studentId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Student ID
              </Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="studentId"
                  type="text"
                  placeholder="e.g. 112012345"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className={`pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm ${error && error.toLowerCase().includes("student") ? "border-red-300 dark:border-red-700" : ""}`}
                  required
                />
              </div>
            </div>

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
                  className={`pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm ${error && error.toLowerCase().includes("email") ? "border-red-300 dark:border-red-700" : ""}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters (A-z, 0-9)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm ${error && error.toLowerCase().includes("password") ? "border-red-300 dark:border-red-700" : ""}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pl-10 h-11 rounded-lg border-gray-200 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:border-gray-300 dark:focus-visible:border-gray-600 text-sm ${error && error.toLowerCase().includes("password") ? "border-red-300 dark:border-red-700" : ""}`}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-lg bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium transition-colors text-sm mt-1"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Account
              {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </form>

          {/* Sign in link */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
