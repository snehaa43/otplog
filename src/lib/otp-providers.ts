/**
 * OTP Delivery Service
 * Supports Resend for Email OTP.
 * Automatically falls back to dev logging when RESEND_API_KEY is not configured.
 */

export interface SendOtpResult {
  success: boolean;
  provider: "resend" | "dev-mock";
  messageId?: string;
  error?: string;
  devOtp?: string;
}

/**
 * Sends a 6-digit OTP code to an email address.
 * Uses Resend API if RESEND_API_KEY is defined; otherwise logs to console for dev/mock testing.
 */
export async function sendEmailOtp(email: string, otp: string): Promise<SendOtpResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Auth <onboarding@resend.dev>";

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `Your Login Code: ${otp}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 8px;">Verification Code</h1>
                <p style="color: #64748b; font-size: 14px; margin: 0;">Use the code below to log into your account.</p>
              </div>
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${otp}</span>
              </div>
              <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0 0 8px;">This code will expire in <strong>5 minutes</strong>.</p>
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">If you did not request this login code, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("[Resend Error]", data);
        return {
          success: false,
          provider: "resend",
          error: data.message || "Failed to send email via Resend.",
        };
      }

      return {
        success: true,
        provider: "resend",
        messageId: data.id,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Email Send Error]", errorMsg);
      return {
        success: false,
        provider: "resend",
        error: errorMsg,
      };
    }
  }

  // Dev Mock Fallback
  console.log("\n=======================================================");
  console.log(`🔑 [DEV EMAIL OTP DISPATCH]`);
  console.log(`📨 To: ${email}`);
  console.log(`🔢 Code: ${otp}`);
  console.log(`⏱️ Expires in: 5 minutes`);
  console.log("=======================================================\n");

  return {
    success: true,
    provider: "dev-mock",
    devOtp: otp,
  };
}
