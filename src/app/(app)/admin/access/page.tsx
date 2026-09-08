import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { AccessManager } from "@/components/admin/access-manager";
import type { RoleGrantRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Access" };

/**
 * Who gets which dashboard.
 *
 * Everyone who signs up is a student. This page is the only supported way to
 * make somebody anything else, so that granting a teacher access to a batch
 * does not require handing out database credentials.
 */
export default async function AccessPage() {
  const admin = createAdminClient();

  const [{ data: grants }, { data: users }] = await Promise.all([
    admin
      .from("role_grants")
      .select("email, role, note, granted_by, created_at, updated_at")
      .order("role")
      .order("email"),
    admin.from("users").select("email, role"),
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
        Anyone who signs up is a student. Listing an email here is the only way
        to change that — and it applies whether or not they have an account yet.
      </p>

      <AccessManager
        initial={(grants ?? []) as RoleGrantRow[]}
        registered={[...registered].filter(Boolean) as string[]}
      />
    </div>
  );
}
