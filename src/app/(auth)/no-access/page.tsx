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
        <h1 className="text-2xl font-semibold tracking-tight">
          This account does not have access yet
        </h1>
        <p className="text-sm text-muted-foreground">
          CaseCode is invite-only. Signing in worked — the address simply has
          not been granted access to the case library.
        </p>
      </div>

      {profile?.email && (
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="mt-1 break-all text-sm font-medium">{profile.email}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Ask the platform owner to add this address, then sign in again. If you
        have more than one Google account, check you used the one that was
        invited.
      </p>

      <SignOutButton />
    </div>
  );
}
