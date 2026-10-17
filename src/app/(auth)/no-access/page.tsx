import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Access needed" };

/**
 * Where middleware sends a signed-in account whose address is not on
 * access_allowlist.
 *
 * It deliberately says the account is fine and the access is missing, rather
 * than implying a failed login — someone who just signed in with Google and
 * landed here would otherwise keep retrying the thing that already worked.
 */
export default async function NoAccessPage() {
  const profile = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1>
          This account is closed
        </h1>
        <p className="text-sm text-muted-foreground">
          Signing in worked, but this account has been deactivated, so it
          cannot open the case library.
        </p>
      </div>

      {profile?.email && (
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="mt-1 break-all text-sm font-medium">{profile.email}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        If you think that is a mistake, contact the CaseCode team from the
        address on this account.
      </p>

      <SignOutButton />
    </div>
  );
}
