"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Sign out and land on the marketing page.
 *
 * Mirrors the account-menu action in site-nav, extracted because /no-access
 * renders outside the app shell and so has no account menu to use.
 */
export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" className="w-full" onClick={signOut}>
      Sign out and use a different account
    </Button>
  );
}
