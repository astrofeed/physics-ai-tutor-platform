import { isGoogleAuthConfigured, signInErrorMessage } from "@/lib/google-auth";
import LoginPageClient from "./LoginPageClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <LoginPageClient
      googleEnabled={isGoogleAuthConfigured}
      initialError={signInErrorMessage(error)}
    />
  );
}
