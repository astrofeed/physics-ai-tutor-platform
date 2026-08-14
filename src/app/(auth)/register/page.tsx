import { isGoogleAuthConfigured } from "@/lib/google-auth";
import RegisterPageClient from "./RegisterPageClient";

export default function RegisterPage() {
  return <RegisterPageClient googleEnabled={isGoogleAuthConfigured} />;
}
