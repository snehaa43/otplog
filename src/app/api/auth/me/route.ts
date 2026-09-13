import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const session = await verifySessionToken(sessionCookie);

    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: session,
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}
