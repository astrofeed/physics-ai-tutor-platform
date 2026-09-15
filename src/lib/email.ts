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

/** Thrown by sendEmail when GMAIL_USER / GMAIL_APP_PASSWORD are unset; nothing is ever "sent" to the log. */
export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured on this server (GMAIL_USER / GMAIL_APP_PASSWORD).");
    this.name = "EmailNotConfiguredError";
  }
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!transporter) {
    console.error(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD not set; not sending "${subject}" to ${Array.isArray(to) ? to.join(", ") : to}`
    );
    throw new EmailNotConfiguredError();
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
