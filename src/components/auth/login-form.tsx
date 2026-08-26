"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/role-home";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

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

    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Log in
      </Button>
    </form>
  );
}
