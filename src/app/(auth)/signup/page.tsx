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
        {/* Sign-up is open (071). Reading is free; practising is Pro, so this
            promises the library, not free grading. */}
        <p className="text-sm text-muted-foreground">
          Read all {MARKETED_CASE_FLOOR}+ cases free. Upgrade to CaseCode Pro to
          have your answers graded — any email works, no college ID needed.
        </p>
      </div>

      {googleEnabled && <GoogleButton />}

      <SignupForm />

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
