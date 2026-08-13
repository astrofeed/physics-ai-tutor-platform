/**
 * Centralized email templates for the PhysTutor platform.
 *
 * All HTML email markup lives here so templates can be previewed, tested, and
 * modified without touching the business logic that sends them.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** HTML-escape user-supplied strings to prevent XSS in email clients. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Strip angle-bracket characters (lighter sanitisation used in some legacy templates). */
function stripHtmlChars(s: string): string {
  return s.replace(/[<>&]/g, "");
}

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------

/**
 * Full-width "branded" email layout used by bulk / notification emails.
 * Wraps content in a centered 600 px card with a coloured header banner.
 */
function brandedLayout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #4f46e5; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">PhysTutor Notification</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">This is an automated message from PhysTutor. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Simple card layout used by internal staff-facing alerts.
 * Has a coloured header bar and a white content area.
 */
function staffAlertLayout(
  headerBg: string,
  headerTitle: string,
  bodyContent: string
): string {
  return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: ${headerBg}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">${headerTitle}</h2>
  </div>
  <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    ${bodyContent}
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Template: Notification / bulk email
// ---------------------------------------------------------------------------

export interface NotificationEmailParams {
  userName: string;
  message: string;
  senderName: string;
}

/**
 * Generic notification email sent to users by staff (bulk email, scheduled
 * emails, etc.).
 */
export function notificationEmail(params: NotificationEmailParams): string {
  return brandedLayout(`
              <p style="margin: 0 0 16px; color: #111827; font-size: 16px;">Dear ${esc(params.userName)},</p>
              <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0; color: #1e1b4b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${esc(params.message)}</p>
              </div>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">&mdash; ${esc(params.senderName)}, PhysTutor Staff</p>`);
}

// ---------------------------------------------------------------------------
// Template: Password reset
// ---------------------------------------------------------------------------

export interface PasswordResetEmailParams {
  userName: string;
  resetUrl: string;
  expiresMinutes: number;
}

/** Email containing a one-time password reset link. */
export function passwordResetEmail(params: PasswordResetEmailParams): string {
  return brandedLayout(`
              <p style="margin: 0 0 16px; color: #111827; font-size: 16px;">Dear ${esc(params.userName)},</p>
              <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">We received a request to reset the password for your PhysTutor account. Click the button below to choose a new password. This link expires in ${params.expiresMinutes} minutes and can only be used once.</p>
              <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #4f46e5; border-radius: 8px;">
                    <a href="${params.resetUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin: 0 0 16px; color: #4f46e5; font-size: 13px; word-break: break-all;">${params.resetUrl}</p>
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>`);
}

// ---------------------------------------------------------------------------
// Template: Account suspended (sent to the banned user)
// ---------------------------------------------------------------------------

export interface AccountSuspendedEmailParams {
  userName: string;
  recentCount: number;
  sourceLabel: string;
}

/**
 * Sent to a user whose account has been automatically suspended for spam.
 */
export function accountSuspendedEmail(params: AccountSuspendedEmailParams): string {
  return staffAlertLayout("#4f46e5", "PhysTutor &mdash; Account Suspended", `
    <p>Hi ${params.userName},</p>
    <p>Your PhysTutor account has been <strong>temporarily suspended</strong> due to unusual activity.</p>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <strong>Reason:</strong> Our system detected ${params.recentCount} rapid ${params.sourceLabel} within 1 minute, which exceeds normal usage patterns.
    </div>
    <p>If you believe this was a mistake, please contact your TA or Professor to have your account reviewed and reinstated.</p>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">This is an automated message. Please do not reply to this email.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">&mdash; PhysTutor System</p>`);
}

// ---------------------------------------------------------------------------
// Template: Staff notification – user auto-banned
// ---------------------------------------------------------------------------

export interface UserAutoBannedStaffEmailParams {
  userName: string;
  userEmail: string;
  reason: string;
  adminUrl: string;
}

/**
 * Sent to TAs / Professors / Admins when a user is automatically banned.
 */
export function userAutoBannedStaffEmail(params: UserAutoBannedStaffEmailParams): string {
  return staffAlertLayout("#dc2626", "User Auto-Banned", `
    <p><strong>${params.userName}</strong> (${params.userEmail}) has been automatically banned.</p>
    <p><strong>Reason:</strong> ${params.reason}</p>
    <p>Visit <a href="${params.adminUrl}/admin/users">User Management</a> to review and unban if needed.</p>`);
}

// ---------------------------------------------------------------------------
// Template: Staff notification – content flag
// ---------------------------------------------------------------------------

export interface ContentFlagStaffEmailParams {
  userName: string;
  userId: string;
  flags: string[];
  messagePreview: string;
  adminUrl: string;
}

/**
 * Sent to staff when a jailbreak / prompt-injection pattern is detected.
 */
export function contentFlagStaffEmail(params: ContentFlagStaffEmailParams): string {
  return `
          <h3>Content Flag Detected</h3>
          <p><strong>User:</strong> ${stripHtmlChars(params.userName)} (${params.userId})</p>
          <p><strong>Matched patterns:</strong> ${params.flags.join(", ")}</p>
          <p><strong>Message preview:</strong></p>
          <blockquote>${stripHtmlChars(params.messagePreview)}</blockquote>
          <p>Review this user in the <a href="${params.adminUrl}/admin/users">admin panel</a>.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">This is an automated message from PhysTutor. Please do not reply to this email.</p>
        `;
}

// ---------------------------------------------------------------------------
// Template: Staff notification – rate limit abuse
// ---------------------------------------------------------------------------

export interface RateLimitAbuseStaffEmailParams {
  userName: string;
  userId: string;
  hitCount: number;
  adminUrl: string;
}

/**
 * Sent to staff when a user repeatedly exceeds the chat rate limit.
 */
export function rateLimitAbuseStaffEmail(params: RateLimitAbuseStaffEmailParams): string {
  return `
          <h3>Rate Limit Abuse Detected</h3>
          <p><strong>User:</strong> ${stripHtmlChars(params.userName)} (${params.userId})</p>
          <p><strong>Rate limit hits:</strong> ${params.hitCount} times in the last hour</p>
          <p>This user has repeatedly exceeded the message rate limit. Consider restricting or contacting them.</p>
          <p>Review this user in the <a href="${params.adminUrl}/admin/users">admin panel</a>.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">This is an automated message from PhysTutor. Please do not reply to this email.</p>
        `;
}

// ---------------------------------------------------------------------------
// Template: Staff notification – unusual message volume
// ---------------------------------------------------------------------------

export interface MessageVolumeStaffEmailParams {
  userName: string;
  userId: string;
  messageCount: number;
  threshold: number;
  adminUrl: string;
}

/** Sent to staff when one user's hourly chat volume crosses the alert threshold. */
export function messageVolumeStaffEmail(params: MessageVolumeStaffEmailParams): string {
  return staffAlertLayout("#b45309", "Unusual Message Volume", `
    <p><strong>User:</strong> ${stripHtmlChars(params.userName)} (${params.userId})</p>
    <p><strong>Messages in the last hour:</strong> ${params.messageCount} (alert threshold: ${params.threshold})</p>
    <p>The account is not blocked. Review usage and restrict the account if this looks like abuse.</p>
    <p>Review this user in the <a href="${params.adminUrl}/admin/users">admin panel</a>.</p>`);
}

// ---------------------------------------------------------------------------
// Template: Email verification
// ---------------------------------------------------------------------------

export interface EmailVerificationParams {
  userName: string;
  verifyUrl: string;
  expiresHours: number;
}

/** Sent after registration; the account cannot use the tutor until verified. */
export function emailVerificationEmail(params: EmailVerificationParams): string {
  return brandedLayout(`
              <p style="margin: 0 0 16px; color: #111827; font-size: 16px;">Dear ${esc(params.userName)},</p>
              <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">Confirm this address to activate your PhysTutor account. The link expires in ${params.expiresHours} hours.</p>
              <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #4f46e5; border-radius: 8px;">
                    <a href="${params.verifyUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">Verify Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin: 0 0 16px; color: #4f46e5; font-size: 13px; word-break: break-all;">${params.verifyUrl}</p>
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">If you didn't create this account, you can ignore this email.</p>`);
}

// ---------------------------------------------------------------------------
// Template: Assignment published notification
// ---------------------------------------------------------------------------

export interface AssignmentPublishedEmailParams {
  studentName: string;
  assignmentTitle: string;
  assignmentDescription?: string | null;
  dueDateStr: string;
  totalPoints: number;
  senderName: string;
}

/**
 * Sent to students when a scheduled assignment is auto-published.
 */
export function assignmentPublishedEmail(params: AssignmentPublishedEmailParams): string {
  const messageLines = [
    "A new assignment has been posted on PhysTutor.",
    "",
    `Title: ${esc(params.assignmentTitle)}`,
    ...(params.assignmentDescription
      ? [`Description: ${esc(params.assignmentDescription)}`]
      : []),
    `Due: ${esc(params.dueDateStr)}`,
    `Points: ${params.totalPoints}`,
    "",
    "",
  ].join("\n");

  return brandedLayout(`
          <p style="margin: 0 0 16px; color: #111827; font-size: 16px;">Dear ${esc(params.studentName)},</p>
          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; color: #1e1b4b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${messageLines}</p>
          </div>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">&mdash; ${esc(params.senderName)}, PhysTutor Staff</p>`);
}
