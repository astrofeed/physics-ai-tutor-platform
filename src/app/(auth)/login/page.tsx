import { isGoogleAuthConfigured, signInErrorMessage } from "@/lib/google-auth";
import LoginPageClient from "./LoginPageClient";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <LoginPageClient
      googleEnabled={isGoogleAuthConfigured}
      initialError={signInErrorMessage(searchParams.error)}
    />
  );
}
