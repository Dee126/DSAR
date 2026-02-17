import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

const fromAddress =
  process.env.SMTP_FROM || "noreply@privacypilot.local";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: "PrivacyPilot – Password Reset",
    text: [
      "You requested a password reset for your PrivacyPilot account.",
      "",
      "Click the link below to set a new password:",
      resetUrl,
      "",
      "This link is valid for 1 hour.",
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">PrivacyPilot</h2>
        <p>You requested a password reset for your PrivacyPilot account.</p>
        <p>Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}"
             style="display: inline-block; padding: 12px 24px; background-color: #4f46e5;
                    color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          This link is valid for 1 hour. If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
