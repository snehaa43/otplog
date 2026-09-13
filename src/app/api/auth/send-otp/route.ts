import { NextRequest, NextResponse } from "next/server";
import { generateOtpSignature } from "@/lib/auth";
import { sendEmailOtp } from "@/lib/otp-providers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const target = body.target || body.email;

    if (!target || typeof target !== "string") {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    const cleanEmail = target.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Expiration: 5 minutes from now
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Send OTP via configured provider (Resend or dev-mock)
    const result = await sendEmailOtp(cleanEmail, otp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to dispatch verification code." },
        { status: 500 }
      );
    }

    // Create HMAC signature token to send back to client
    const signature = generateOtpSignature(cleanEmail, otp, expiresAt);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}`,
      token: {
        target: cleanEmail,
        type: "email",
        expiresAt,
        signature,
      },
      provider: result.provider,
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (error: unknown) {
    console.error("Error in /api/auth/send-otp:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
