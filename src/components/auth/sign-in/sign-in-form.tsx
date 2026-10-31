"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/role-home";
import { useGoogleSignIn } from "@/components/auth/google-button";
import { removeStored, useStored, writeStored } from "@/hooks/use-browser-state";
import { LAST_EMAIL_KEY, PENDING_BATCH_CODE_KEY, joinBatch } from "./batch-code";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

const inputClass =
  "w-full rounded-xl border border-cc-border bg-cc-card px-3.5 py-3 text-sm text-cc-ink outline-none transition-all placeholder:text-cc-muted focus:border-cc-accent focus:ring-1 focus:ring-cc-accent aria-invalid:border-cc-vermilion";

/**
 * Email and password sign-in against Supabase, plus Google and the reset
 * link. After signing in it redeems a batch key held from the Campus Key
 * dialog, then lands on the account's own dashboard.
 */
export function SignInForm({
  next,
  googleEnabled,
  pendingCode,
}: {
  next: string;
  googleEnabled: boolean;
  pendingCode: string | null;
}) {
  const router = useRouter();
  const lastEmail = useStored(LAST_EMAIL_KEY);
  // null until typed in, so the remembered address shows without an effect.
  const [typedEmail, setTypedEmail] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sendingReset, setSendingReset] = React.useState(false);

  const email = typedEmail ?? lastEmail ?? "";
  const showLastUsed = typedEmail === null && Boolean(lastEmail);

  // With a held batch key, come back to /login after Google so the key is
  // redeemed under the new session (SignInScreen does that on arrival).
  const google = useGoogleSignIn(pendingCode ? "/login" : next);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    const found: FieldErrors = {};
    if (!EMAIL.test(address)) found.email = "Please enter a valid email address.";
    if (!password) found.password = "Please enter your password.";
    setErrors(found);
    setFormError(null);
    if (found.email || found.password) return;

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });

    if (error) {
      setFormError(error.message);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    writeStored(LAST_EMAIL_KEY, address);

    /**
     * Land on the dashboard that belongs to this account.
     *
     * `next` is honoured when the user was actually going somewhere — they
     * clicked a link, got bounced to /login, and should end up where they
     * meant to. But its default is /dashboard, which for a teacher or the
     * platform owner is somebody else's product. Resolving the role here means
     * signing in as an admin lands on /admin, not on a student dashboard
     * showing zeros.
     *
     * The middleware would correct it a moment later anyway; doing it here
     * saves the visible bounce.
     */
    let destination = next;

    if (!next || next === "/dashboard") {
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        destination = roleHome(profile?.role ?? null);
      }
    }

    if (pendingCode) {
      const joined = await joinBatch(pendingCode);
      removeStored(PENDING_BATCH_CODE_KEY);
      if (joined.ok) {
        toast.success(`Batch key ${pendingCode} verified — you've joined the batch.`);
        destination = `/classrooms/${joined.classroomId}`;
      } else {
        toast.error(`Batch key ${pendingCode}: ${joined.error}`);
      }
    }

    router.push(destination);
    router.refresh();
  }

  async function sendReset() {
    const address = email.trim();
    // No address yet: the full reset page asks for one.
    if (!EMAIL.test(address)) {
      router.push("/forgot-password");
      return;
    }

    setSendingReset(true);
    const { error } = await createClient().auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setSendingReset(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    // Same wording whether or not the address is registered — anything else
    // is an account-enumeration leak.
    toast.success(`If ${address} has an account, we've sent a reset link. It expires in one hour.`);
  }

  return (
    <>
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={google.signInWithGoogle}
            disabled={google.loading}
            className="group mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-cc-border bg-cc-card/90 px-4 py-3 text-sm font-medium text-cc-ink shadow-sm transition-all hover:border-cc-muted hover:bg-cc-surface active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {google.loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-cc-muted/40 border-t-cc-ink" />
            ) : (
              <GoogleMark />
            )}
            <span>Continue with Google</span>
          </button>
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full border-t border-cc-border/70" />
            <span className="absolute bg-cc-canvas px-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-cc-muted">
              or
            </span>
          </div>
        </>
      )}

      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-cc-vermilion/40 bg-cc-vermilion/10 px-3.5 py-2.5 text-xs text-cc-ink"
        >
          {formError}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="email" className="text-xs font-normal text-cc-ink-2">
              Email
            </label>
            {showLastUsed && (
              <span className="rounded-full border border-cc-border bg-cc-card px-2 py-0.5 font-mono text-[10px] text-cc-accent-ink">
                Last used
              </span>
            )}
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(event) => {
              setTypedEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass}
          />
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-xs text-cc-vermilion">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-normal text-cc-ink-2">
              Password
            </label>
            <button
              type="button"
              onClick={sendReset}
              disabled={sendingReset}
              className="text-xs font-normal text-cc-accent transition-colors hover:text-cc-accent-ink disabled:opacity-60"
            >
              {sendingReset ? "Sending link…" : "Forgot password?"}
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-cc-muted transition-colors hover:text-cc-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={
                    showPassword
                      ? "M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.7 10.7 0 0112 5c4.48 0 8.27 2.94 9.54 7a10.8 10.8 0 01-3.2 4.7M6.2 6.2A10.8 10.8 0 002.46 12c1.27 4.06 5.06 7 9.54 7 1.1 0 2.16-.18 3.14-.5"
                      : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  }
                />
              </svg>
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="mt-1.5 text-xs text-cc-vermilion">
              {errors.password}
            </p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cc-accent px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-cc-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span>{loading ? "Signing in..." : "Sign in"}</span>
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
          </button>
        </div>
      </form>
    </>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.48 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z" />
    </svg>
  );
}
