import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target, type, name, photoUrl } = body;

    if (!target || !type) {
      return NextResponse.json(
        { error: "Target (email or phone) and type are required." },
        { status: 400 }
      );
    }

    if (type !== "google" && type !== "phone") {
      return NextResponse.json(
        { error: "Invalid Firebase session type." },
        { status: 400 }
      );
    }

    const cleanTarget = String(target).trim();

    // Create secure JWT session token
    const sessionToken = await createSessionToken({
      target: cleanTarget,
      type,
      name: name || undefined,
      photoUrl: photoUrl || undefined,
    });

    const response = NextResponse.json({
      success: true,
      message: "Firebase session initialized successfully.",
      user: {
        target: cleanTarget,
        type,
        name,
        photoUrl,
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
    console.error("Error in /api/auth/firebase-session:", error);
    return NextResponse.json(
      { error: "Failed to establish authenticated session." },
      { status: 500 }
    );
  }
}
