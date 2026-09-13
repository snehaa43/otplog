"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  ArrowRight,
  Shield,
  RefreshCw,
  Edit2,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import CountryCodeSelector, { COUNTRIES, Country } from "@/components/CountryCodeSelector";
import OtpInput from "@/components/OtpInput";
import {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  isFirebaseConfigured,
} from "@/lib/firebase";

type AuthTab = "email" | "phone";

interface EmailOtpTokenPayload {
  target: string;
  type: "email";
  expiresAt: number;
  signature: string;
}

export default function LoginPage() {
  const router = useRouter();

  // Navigation / Mode State
  const [activeTab, setActiveTab] = useState<AuthTab>("email");
  const [step, setStep] = useState<"input" | "otp">("input");

  // Email form state
  const [email, setEmail] = useState("");
  const [emailTokenPayload, setEmailTokenPayload] = useState<EmailOtpTokenPayload | null>(null);

  // Phone form state (Firebase)
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // OTP Verification state
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Status & UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
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

  // Clean up recaptcha on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup error
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const getFullPhoneNumber = () => {
    const clean = phoneNumber.trim().replace(/^0+/, "");
    return `${selectedCountry.dial_code}${clean}`;
  };

  const getMaskedTarget = () => {
    if (activeTab === "email") {
      const cleanEmail = email.trim().toLowerCase();
      const [user, domain] = cleanEmail.split("@");
      if (!user || !domain) return cleanEmail;
      if (user.length <= 2) return `${user[0]}***@${domain}`;
      return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
    }
    const target = getFullPhoneNumber();
    if (target.length < 6) return target;
    const last4 = target.slice(-4);
    const start = target.slice(0, target.length - 4);
    return `${start}****${last4}`;
  };

  const formatFirebaseError = (err: unknown, defaultMsg: string) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("region enabled") || msg.includes("SMS unable to be sent until this region enabled")) {
      return "SMS region disabled. Go to Firebase Console > Authentication > Settings > SMS region policy and allow your country, or add a test phone number.";
    }
    if (msg.includes("auth/configuration-not-found") || msg.includes("auth/operation-not-allowed")) {
      return "Provider not enabled in Firebase. Go to Firebase Console > Authentication > Sign-in method and enable it.";
    }
    if (msg.includes("auth/billing-not-enabled")) {
      return "Firebase requires Cloud Billing / Blaze plan for sending real carrier SMS. You can test for free by adding your number under Firebase Console > Authentication > Phone > Phone numbers for testing.";
    }
    if (msg.includes("auth/invalid-phone-number")) {
      return "Invalid phone number. Please check country code and number.";
    }
    if (msg.includes("auth/quota-exceeded")) {
      return "SMS quota exceeded. Add test phone numbers in Firebase Console for free testing.";
    }
    if (msg.includes("auth/too-many-requests")) {
      return "Too many attempts. Please wait a moment and try again.";
    }
    return msg || defaultMsg;
  };

  // 1. Google Sign-In Flow
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessToast(null);

    if (!auth || !isFirebaseConfigured) {
      setErrorMsg(
        "Firebase is not configured yet. Please add your NEXT_PUBLIC_FIREBASE_* keys to .env.local"
      );
      return;
    }

    setIsGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Establish backend session
      const res = await fetch("/api/auth/firebase-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: user.email || user.displayName || user.uid,
          type: "google",
          name: user.displayName || undefined,
          photoUrl: user.photoURL || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create user session.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Google sign in error:", err);
      const msg = formatFirebaseError(err, "Failed to sign in with Google.");
      if (!msg.includes("popup-closed-by-user")) {
        setErrorMsg(msg);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 2. Setup Firebase Recaptcha Verifier
  const setupRecaptcha = () => {
    if (!auth) {
      throw new Error("Firebase Auth is not available.");
    }
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
        "expired-callback": () => {
          setErrorMsg("reCAPTCHA expired. Please try sending code again.");
        },
      });
    }
    return recaptchaVerifierRef.current;
  };

  // 3. Send OTP (Email or Phone)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessToast(null);

    if (activeTab === "email") {
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

        setEmailTokenPayload(data.token);
        if (data.devOtp) {
          setDevOtp(data.devOtp);
        } else {
          setDevOtp(null);
        }
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
    } else {
      // Phone OTP via Firebase
      const fullPhone = getFullPhoneNumber();
      const digits = fullPhone.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        setErrorMsg("Please enter a valid mobile number with country code.");
        return;
      }

      if (!auth || !isFirebaseConfigured) {
        setErrorMsg(
          "Firebase Phone Auth is not configured. Please add NEXT_PUBLIC_FIREBASE_* keys to .env.local"
        );
        return;
      }

      setIsLoading(true);

      try {
        const appVerifier = setupRecaptcha();
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
        setConfirmationResult(confirmation);
        setDevOtp(null);
        setStep("otp");
        setOtp("");
        setResendCooldown(60);
        setCanResend(false);
        setSuccessToast(`SMS verification code sent to ${fullPhone}`);
      } catch (err: unknown) {
        console.error("Firebase phone auth error:", err);
        // Reset recaptcha if failed
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch {
            // ignore
          }
          recaptchaVerifierRef.current = null;
        }
        const msg = formatFirebaseError(err, "Failed to send SMS OTP.");
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 4. Verify OTP Code
  const handleVerifyOtp = useCallback(
    async (codeToVerify?: string) => {
      const finalOtp = (codeToVerify || otp).trim();
      if (finalOtp.length !== 6) {
        setErrorMsg("Please enter the complete 6-digit code.");
        return;
      }

      setErrorMsg(null);
      setIsLoading(true);

      try {
        if (activeTab === "email") {
          if (!emailTokenPayload) {
            throw new Error("Session expired. Please request a new code.");
          }

          const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: emailTokenPayload.target,
              type: emailTokenPayload.type,
              otp: finalOtp,
              expiresAt: emailTokenPayload.expiresAt,
              signature: emailTokenPayload.signature,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Invalid verification code.");
          }

          router.push("/dashboard");
        } else {
          // Verify Phone OTP with Firebase ConfirmationResult
          if (!confirmationResult) {
            throw new Error("Phone session expired. Please request a new code.");
          }

          const userCredential = await confirmationResult.confirm(finalOtp);
          const user = userCredential.user;

          // Create backend session cookie
          const res = await fetch("/api/auth/firebase-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: user.phoneNumber || getFullPhoneNumber(),
              type: "phone",
            }),
          });

          if (!res.ok) {
            throw new Error("Failed to establish authenticated session.");
          }

          router.push("/dashboard");
        }
      } catch (err: unknown) {
        console.error("Verification error:", err);
        setErrorMsg(err instanceof Error ? err.message : "Verification failed.");
        setIsLoading(false);
      }
    },
    [activeTab, otp, emailTokenPayload, confirmationResult, router]
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-zinc-50 text-zinc-950">
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-black text-white mb-3 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">
            Welcome back
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Sign in with Google, Email, or Phone OTP
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6">
          {step === "input" ? (
            <div>
              {/* 1. Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="w-full h-11 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-300 rounded-lg font-medium text-xs flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-5 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200"></div>
                </div>
                <span className="relative bg-white px-3 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  or
                </span>
              </div>

              {/* Tab Selector */}
              <div className="flex p-1 bg-zinc-100 rounded-lg mb-4 border border-zinc-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("email");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                    activeTab === "email"
                      ? "bg-black text-white shadow-xs"
                      : "text-zinc-600 hover:text-black"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("phone");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                    activeTab === "phone"
                      ? "bg-black text-white shadow-xs"
                      : "text-zinc-600 hover:text-black"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSendOtp} className="space-y-4">
                {activeTab === "email" ? (
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
                        required
                        className="w-full pl-9.5 pr-3.5 h-11 bg-white border border-zinc-300 rounded-lg text-black text-xs placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-semibold text-zinc-800 mb-1.5"
                    >
                      Mobile number
                    </label>
                    <div className="flex rounded-lg">
                      <CountryCodeSelector
                        selected={selectedCountry}
                        onSelect={setSelectedCountry}
                        disabled={isLoading}
                      />
                      <input
                        id="phone"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="98765 43210"
                        required
                        className="flex-1 min-w-0 pl-3 pr-3.5 h-11 bg-white border border-l-0 border-zinc-300 rounded-r-lg text-black text-xs placeholder:text-zinc-400 focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>
                )}

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
                  disabled={isLoading || isGoogleLoading}
                  className="w-full mt-1 h-11 bg-black hover:bg-zinc-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
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
                    {getMaskedTarget()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("input");
                      setErrorMsg(null);
                      setSuccessToast(null);
                    }}
                    className="p-0.5 text-zinc-600 hover:text-black rounded"
                    title="Change"
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

              {/* Dev Mode OTP Display & Quick Auto-fill */}
              {devOtp && (
                <div className="flex items-center justify-between p-2.5 mb-3 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">Dev OTP:</span>
                    <span className="font-mono tracking-widest font-bold bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                      {devOtp}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtp(devOtp);
                      handleVerifyOtp(devOtp);
                    }}
                    className="px-2 py-1 text-[11px] font-semibold bg-black text-white hover:bg-zinc-800 rounded transition-all active:scale-95"
                  >
                    Auto-fill & Verify
                  </button>
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
          Protected with end-to-end stateless authentication
        </p>
      </div>
    </main>
  );
}
