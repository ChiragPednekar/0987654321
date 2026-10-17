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
        {/* Sign-up is open (071), but the product opens only with Pro or a
            college licence (072), so this promises neither free reading nor
            free grading. */}
        <p className="text-sm text-muted-foreground">
          {MARKETED_CASE_FLOOR}+ cases, marked against a rubric. Any email works —
          pick a plan after signing up, or use your college&apos;s licence.
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
