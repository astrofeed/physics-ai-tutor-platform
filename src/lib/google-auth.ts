export const GOOGLE_ALLOWED_DOMAINS = (
  process.env.GOOGLE_ALLOWED_EMAIL_DOMAINS ?? "gapp.nthu.edu.tw"
)
  .split(",")
  .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean);

export const isGoogleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export function isAllowedGoogleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.toLowerCase().split("@")[1];
  return domain !== undefined && GOOGLE_ALLOWED_DOMAINS.includes(domain);
}

/** Message shown on /login for each NextAuth `?error=` code. */
export const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: `Sign-in was denied. Use a ${GOOGLE_ALLOWED_DOMAINS.map((d) => `@${d}`).join(" or ")} Google account; if your account is suspended, contact your instructor.`,
  OAuthAccountNotLinked:
    "That email already has a password account. Sign in with your password instead.",
  Configuration: "Google sign-in is not configured on this server.",
  Verification: "That sign-in link has expired. Request a new one.",
};

export function signInErrorMessage(error: string | null | undefined): string | null {
  if (!error) return null;
  return SIGN_IN_ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again.";
}
