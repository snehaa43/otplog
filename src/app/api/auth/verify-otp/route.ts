import { NextRequest, NextResponse } from "next/server";
import { verifyOtpSignature, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target, otp, expiresAt, signature } = body;
    const cleanTarget = (target || body.email || "").trim().toLowerCase();

    if (!cleanTarget || !otp || !expiresAt || !signature) {
      return NextResponse.json(
        { error: "Missing required verification parameters." },
        { status: 400 }
      );
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { error: "Invalid verification code format. Must be 6 digits." },
        { status: 400 }
      );
    }

    const isValid = verifyOtpSignature(
      cleanTarget,
      cleanOtp,
      Number(expiresAt),
      signature
    );

    if (!isValid) {
      if (Date.now() > Number(expiresAt)) {
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // Create session token
    const sessionToken = await createSessionToken({
      target: cleanTarget,
      type: "email",
    });

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful.",
      user: {
        target: cleanTarget,
        type: "email",
      },
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Error in /api/auth/verify-otp:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while verifying the code." },
      { status: 500 }
    );
  }
}
