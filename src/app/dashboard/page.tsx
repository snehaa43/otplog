"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Check } from "lucide-react";

interface SessionData {
  target: string;
  type?: "email";
  sessionId: string;
  loginAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const data = await res.json();
        if (data.authenticated && data.user) {
          setSession(data.user);
        } else {
          router.replace("/");
        }
      } catch {
        router.replace("/");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const formattedDate = session.loginAt
    ? new Date(session.loginAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Just now";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-zinc-50 text-zinc-950">
      <div className="w-full max-w-sm">
        {/* Main Minimal Card */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6 sm:p-8">
          {/* Status Indicator */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Session Active
              </span>
            </div>
            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 text-black">
              <Check className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-xl font-bold tracking-tight text-black mb-1">
            You are logged in.
          </h1>
          <p className="text-xs text-zinc-500 mb-6">
            Your email has been verified successfully.
          </p>

          {/* Metadata list */}
          <div className="space-y-3 text-xs mb-8">
            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Email</span>
              <span className="font-semibold text-black truncate max-w-[190px]">
                {session.target}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Auth Method</span>
              <span className="text-zinc-900 font-medium">
                Email OTP
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Session ID</span>
              <span className="font-mono text-zinc-600 truncate max-w-[160px]">
                {session.sessionId}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Timestamp</span>
              <span className="text-zinc-900 font-medium">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full h-11 bg-black hover:bg-zinc-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Secure stateless session
        </p>
      </div>
    </main>
  );
}
