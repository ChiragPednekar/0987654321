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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          {MARKETED_CASE_FLOOR}+ cases. Rubric-based AI feedback. Free to start.
        </p>
      </div>

      {googleEnabled && <GoogleButton />}

      <SignupForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
