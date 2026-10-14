import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/google-button";
import { googleSignInEnabled } from "@/lib/auth-providers";
import { MARKETED_CASE_FLOOR } from "@/lib/constants";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const googleEnabled = await googleSignInEnabled();
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1>
          Create your <em className="italic">account</em>.
        </h1>
        {/* Access is through a college licence (invite-only), so this does
            not promise "free to start": use the address you were invited with. */}
        <p className="text-sm text-muted-foreground">
          {MARKETED_CASE_FLOOR}+ cases, marked against a rubric. Use the email
          address your college invited.
        </p>
      </div>

      {googleEnabled && <GoogleButton />}

      <SignupForm />

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
