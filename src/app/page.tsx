"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  ArrowRight,
  Shield,
  RefreshCw,
  Edit2,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import OtpInput from "@/components/OtpInput";

interface OtpTokenPayload {
  target: string;
  type: "email";
  expiresAt: number;
  signature: string;
}

export default function LoginPage() {
  const router = useRouter();

  // State
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"input" | "otp">("input");

  // OTP Verification state
  const [otp, setOtp] = useState("");
  const [tokenPayload, setTokenPayload] = useState<OtpTokenPayload | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Status & UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "otp" && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  // Mask email for display (e.g. j***e@example.com)
  const getMaskedEmail = () => {
    const target = email.trim().toLowerCase();
    const [user, domain] = target.split("@");
    if (!user || !domain) return target;
    if (user.length <= 2) return `${user[0]}***@${domain}`;
    return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
  };

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessToast(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          target: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setTokenPayload(data.token);
      setStep("otp");
      setOtp("");
      setResendCooldown(60);
      setCanResend(false);
      setSuccessToast(`Verification code sent to ${cleanEmail}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = useCallback(
    async (codeToVerify?: string) => {
      const finalOtp = (codeToVerify || otp).trim();
      if (finalOtp.length !== 6) {
        setErrorMsg("Please enter the complete 6-digit code.");
        return;
      }

      if (!tokenPayload) {
        setErrorMsg("Session expired. Please request a new code.");
        setStep("input");
        return;
      }

      setErrorMsg(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: tokenPayload.target,
            type: tokenPayload.type,
            otp: finalOtp,
            expiresAt: tokenPayload.expiresAt,
            signature: tokenPayload.signature,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Invalid verification code.");
        }

        router.push("/dashboard");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Verification failed.");
        setIsLoading(false);
      }
    },
    [otp, tokenPayload, router]
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-zinc-50 text-zinc-950">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-black text-white mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">
            Sign In
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Enter your email to receive a login verification code
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6">
          {step === "input" ? (
            /* STEP 1: ENTER EMAIL */
            <div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-zinc-800 mb-1.5"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoFocus
                      required
                      className="w-full pl-9.5 pr-3.5 h-11 bg-white border border-zinc-300 rounded-lg text-black text-xs placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs animate-shake">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full mt-1 h-11 bg-black hover:bg-zinc-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending code...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* STEP 2: ENTER OTP */
            <div className="animate-fade-in">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-100 text-black mb-2.5 border border-zinc-200">
                  <Lock className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-black">
                  Enter 6-digit code
                </h2>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-zinc-500">
                  <span>Sent to</span>
                  <span className="font-semibold text-black">
                    {getMaskedEmail()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("input");
                      setErrorMsg(null);
                      setSuccessToast(null);
                    }}
                    className="p-0.5 text-zinc-600 hover:text-black rounded"
                    title="Change email"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Success Toast */}
              {successToast && (
                <div className="flex items-center gap-1.5 p-2 mb-3 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{successToast}</span>
                </div>
              )}

              {/* 6-Digit OTP Boxes */}
              <div className="my-5">
                <OtpInput
                  value={otp}
                  onChange={(val) => {
                    setOtp(val);
                    setErrorMsg(null);
                  }}
                  length={6}
                  disabled={isLoading}
                  hasError={Boolean(errorMsg)}
                  onComplete={(completedCode) => handleVerifyOtp(completedCode)}
                />
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="flex items-start gap-2 p-2.5 mb-3 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs animate-shake">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Verify Button */}
              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={isLoading || otp.length !== 6}
                className="w-full h-11 bg-black hover:bg-zinc-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Resend Code */}
              <div className="mt-5 text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-black hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend code</span>
                  </button>
                ) : (
                  <p className="text-xs text-zinc-400">
                    Resend code in{" "}
                    <span className="font-mono font-medium text-zinc-700">
                      {Math.floor(resendCooldown / 60)}:
                      {(resendCooldown % 60).toString().padStart(2, "0")}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Protected with end-to-end stateless OTP verification
        </p>
      </div>
    </main>
  );
}
