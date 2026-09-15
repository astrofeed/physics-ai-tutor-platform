import nodemailer from "nodemailer";

const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      })
    : null;

const FROM_EMAIL = process.env.EMAIL_FROM || `PhysTutor <${process.env.GMAIL_USER || "noreply@phystutor.app"}>`;

/** False when no Gmail credentials are set; sendEmail then only logs. */
export const emailConfigured = transporter !== null;

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD not set. Would have sent "${subject}" to ${Array.isArray(to) ? to.join(", ") : to}`
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
    });
  } catch (error) {
    console.error("[email] Failed to send:", error);
    throw error;
  }
}
