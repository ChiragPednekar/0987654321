import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { AccessManager } from "@/components/admin/access-manager";
import { AllowlistManager } from "@/components/admin/allowlist-manager";
import type { AccessAllowlistRow, RoleGrantRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Access" };

/**
 * Two questions, deliberately answered by two lists on one page.
 *
 * The lower panel is who may sign in at all — 20250101000060 made the platform
 * invite-only, so an address absent from it cannot create an account. The
 * upper panel is which dashboard they land on once they can. Both exist so
 * that neither onboarding a teacher nor inviting a batch requires handing out
 * database credentials.
 */
export default async function AccessPage() {
  const admin = createAdminClient();

  const [{ data: grants }, { data: users }, { data: allowed }] =
    await Promise.all([
      admin
        .from("role_grants")
        .select("email, role, note, granted_by, created_at, updated_at")
        .order("role")
        .order("email"),
      admin.from("users").select("email, role"),
      admin
        .from("access_allowlist")
        .select("email, note, granted_by, created_at")
        .order("email"),
    ]);

  // Which allowlisted people have actually signed up. An email can be granted
  // before the account exists — that is half the point — and an admin looking
  // at this list should be able to tell the difference between "pending" and
  // "active" without cross-referencing the users page.
  const registered = new Set((users ?? []).map((u) => u.email?.toLowerCase()));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Access</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A listed address signs in as a student. Granting a role here is the only
        way to change that — and it applies whether or not they have an account
        yet.
      </p>

      <AccessManager
        initial={(grants ?? []) as RoleGrantRow[]}
        registered={[...registered].filter(Boolean) as string[]}
      />

      <AllowlistManager
        initial={(allowed ?? []) as AccessAllowlistRow[]}
        registered={[...registered].filter(Boolean) as string[]}
      />
    </div>
  );
}
