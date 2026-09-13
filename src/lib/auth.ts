import { SignJWT, jwtVerify } from "jose";
import { createHmac } from "crypto";

const SECRET_KEY = process.env.SESSION_SECRET || "super-secure-dev-session-secret-key-32-chars-min!";
const SECRET_KEY_UINT8 = new TextEncoder().encode(SECRET_KEY);

export const AUTH_COOKIE_NAME = "auth_session";

export interface SessionUser {
  target: string;
  type: "email";
  sessionId: string;
  loginAt: string;
}

/**
 * Creates an HMAC signature for stateless, tamper-proof OTP verification.
 */
export function generateOtpSignature(target: string, otp: string, expiresAt: number): string {
  const data = `${target.toLowerCase().trim()}:${otp}:${expiresAt}`;
  return createHmac("sha256", SECRET_KEY).update(data).digest("hex");
}

/**
 * Validates the HMAC signature and expiration timestamp of an OTP.
 */
export function verifyOtpSignature(
  target: string,
  otp: string,
  expiresAt: number,
  providedSignature: string
): boolean {
  if (Date.now() > expiresAt) {
    return false;
  }
  const expectedSignature = generateOtpSignature(target, otp, expiresAt);
  return expectedSignature === providedSignature;
}

/**
 * Generates an encrypted/signed JWT session cookie token.
 */
export async function createSessionToken(user: { target: string; type?: string }): Promise<string> {
  const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const loginAt = new Date().toISOString();

  return await new SignJWT({
    target: user.target,
    type: "email",
    sessionId,
    loginAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY_UINT8);
}

/**
 * Verifies and decodes a JWT session token.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY_UINT8);
    return {
      target: payload.target as string,
      type: "email",
      sessionId: payload.sessionId as string,
      loginAt: payload.loginAt as string,
    };
  } catch {
    return null;
  }
}

/**
 * Helper to mask sensitive email address for display.
 */
export function maskEmail(email: string): string {
  const [name, domain] = email.trim().toLowerCase().split("@");
  if (!name || !domain) return email;
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}
