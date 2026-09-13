"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Check, Mail, Phone, User as UserIcon } from "lucide-react";
import Image from "next/image";

interface SessionData {
  target: string;
  type?: "email" | "phone" | "google";
  name?: string;
  photoUrl?: string;
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

  const getProviderBadge = () => {
    if (session.type === "google") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
          <svg className="w-3 h-3" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google Auth</span>
        </div>
      );
    }
    if (session.type === "phone") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
          <Phone className="w-3 h-3" />
          <span>Firebase Phone OTP</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 font-medium">
        <Mail className="w-3 h-3" />
        <span>Email OTP</span>
      </div>
    );
  };

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

          {/* User Profile avatar if Google user */}
          <div className="flex items-center gap-3 mb-6">
            {session.photoUrl ? (
              <Image
                src={session.photoUrl}
                alt={session.name || "User Avatar"}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border border-zinc-200 object-cover"
                unoptimized
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600">
                <UserIcon className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-black truncate">
                {session.name || "Logged In User"}
              </h1>
              <p className="text-xs text-zinc-500 truncate">{session.target}</p>
            </div>
          </div>

          {/* Metadata list */}
          <div className="space-y-3 text-xs mb-8">
            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Auth Method</span>
              {getProviderBadge()}
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Target Identifier</span>
              <span className="font-semibold text-black truncate max-w-[190px]">
                {session.target}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Session ID</span>
              <span className="font-mono text-zinc-600 truncate max-w-[160px]">
                {session.sessionId}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Login Time</span>
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
