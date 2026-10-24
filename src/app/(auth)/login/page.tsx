import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { googleSignInEnabled } from "@/lib/auth-providers";
import { getCurrentUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const profile = await getCurrentUser();
  const googleEnabled = await googleSignInEnabled();
  const next = params.next?.startsWith("/") ? params.next : "/dashboard";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1>
          Welcome <em className="italic">back</em>.
        </h1>
        <p className="text-sm text-muted-foreground">
          Log in to keep your streak alive.
        </p>
      </div>

      {profile && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium truncate">Already signed in</p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
          <Button size="sm" variant="ink" asChild>
            <Link href={next}>Go to {next === "/dashboard" ? "Dashboard" : "Page"}</Link>
          </Button>
        </div>
      )}

      {params.error && (
        <div
          role="alert"
          className="rounded-xl bg-danger-surface px-4 py-2.5 text-sm text-danger"
        >
          {params.error}
        </div>
      )}

      {googleEnabled && <GoogleButton next={next} />}

      <LoginForm next={next} />

      <p className="text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
