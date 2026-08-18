"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD = 8;

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  // When confirmation is required there is no session, and a toast is too easy
  // to miss — it reads as "signup did nothing". Hold the screen instead.
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));

    if (password.length < MIN_PASSWORD) {
      toast.error(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: String(formData.get("email")),
      password,
      options: {
        data: {
          full_name: String(formData.get("full_name")),
          university: String(formData.get("university") ?? ""),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // With email confirmation on, there is no session yet.
    if (!data.session) {
      setPendingEmail(String(formData.get("email")));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (pendingEmail) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-5 text-center">
        <MailCheck className="mx-auto size-8 text-primary" />
        <div className="space-y-1.5">
          <p className="font-medium">Confirm your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{pendingEmail}</span>.
            Your account is not active until you open it.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Nothing arrived? Check spam, then try again in a few minutes —
          confirmation emails are rate limited.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setPendingEmail(null)}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="university">
          University <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id="university" name="university" autoComplete="organization" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
        />
        <p className="text-xs text-muted-foreground">
          At least {MIN_PASSWORD} characters.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
