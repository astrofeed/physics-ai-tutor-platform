import { test, expect } from "@playwright/test";

/**
 * Google sign-in is optional: without GOOGLE_CLIENT_ID/SECRET the button must
 * not be offered, and failed OAuth attempts must explain themselves.
 */
test.describe("Google sign-in surface", () => {
  test("hides the Google button when the provider is not configured", async ({ page }) => {
    test.skip(
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      "Google provider is configured in this environment"
    );

    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();

    await page.goto("/register");
    await expect(page.getByRole("button", { name: /sign up with google/i })).toHaveCount(0);
  });

  test("explains a denied Google sign-in instead of showing a bare error page", async ({ page }) => {
    await page.goto("/login?error=AccessDenied");
    await expect(page.getByText(/@gapp\.nthu\.edu\.tw/)).toBeVisible();

    await page.goto("/login?error=OAuthAccountNotLinked");
    await expect(page.getByText(/already has a password account/i)).toBeVisible();
  });
});
