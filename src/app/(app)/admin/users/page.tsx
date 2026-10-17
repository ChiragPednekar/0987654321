import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserFilters } from "@/components/admin/user-filters";
import { UserActions } from "@/components/admin/user-actions";
import { SubscriptionActions } from "@/components/admin/subscription-actions";
import { formatDay, formatNumber, plural, timeAgo } from "@/lib/utils";
import type { AdminUserRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 50;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const admin = createAdminClient();

  // Paginated and filtered in the database. A platform that works will not fit
  // its user table on one page, and fetching it to count in JavaScript would
  // stop working exactly when it starts mattering.
  const { data } = await admin.rpc("admin_user_list", {
    p_search: params.q?.trim() || null,
    p_role: params.role || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });

  const rows = (data ?? []) as AdminUserRow[];

  // Live subscription periods for the accounts on this page: the latest end
  // per account, and whether any of it was granted by hand.
  const { data: subs } = rows.length
    ? await admin
        .from("subscriptions")
        .select("user_id, current_period_end, source")
        .in("user_id", rows.map((r) => r.id))
        .eq("status", "active")
        .gt("current_period_end", new Date().toISOString())
    : { data: [] as { user_id: string; current_period_end: string | null; source: string }[] };
  const subByUser = new Map<string, { endsAt: string; manual: boolean }>();
  for (const sub of subs ?? []) {
    if (!sub.current_period_end) continue;
    const prev = subByUser.get(sub.user_id);
    subByUser.set(sub.user_id, {
      endsAt: !prev || sub.current_period_end > prev.endsAt ? sub.current_period_end : prev.endsAt,
      manual: Boolean(prev?.manual) || sub.source === "manual",
    });
  }
  const deactivated = rows.filter((u) => u.deactivated_at).length;
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {plural(Number(total), "account")}
          {deactivated > 0 ? `, ${formatNumber(deactivated)} deactivated on this page` : ""}.
        </p>
      </div>

      <div className="mt-6">
        <UserFilters />
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No users match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Institution</th>
                    <th className="px-4 py-3 text-right font-medium">Solved</th>
                    <th className="px-4 py-3 text-right font-medium">CE</th>
                    <th className="px-4 py-3 text-right font-medium">Last active</th>
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/u/${u.id}`} className="font-medium hover:underline">
                          {u.full_name ?? "Unnamed"}
                        </Link>
                        {u.deactivated_at ? (
                          <Badge variant="destructive" className="ml-2">
                            Deactivated
                          </Badge>
                        ) : null}
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === "admin" ? "default" : "outline"}>
                          {u.role}
                        </Badge>
                        {u.plan === "pro" ? (
                          <Badge variant="secondary" className="ml-1" title="Granted by hand, no end date">Pro</Badge>
                        ) : null}
                        {subByUser.get(u.id) ? (
                          <Badge variant="secondary" className="ml-1" title={subByUser.get(u.id)!.manual ? "Includes a hand-granted period" : "Paid subscription"}>
                            Pro until {formatDay(subByUser.get(u.id)!.endsAt)}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.institution ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular">{u.cases_solved}</td>
                      <td className="px-4 py-3 text-right tabular">{formatNumber(u.ce)}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {u.last_active ? timeAgo(u.last_active) : "never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SubscriptionActions
                          userId={u.id}
                          name={u.full_name ?? u.email}
                          hasManualGrant={Boolean(subByUser.get(u.id)?.manual)}
                        />
                        <UserActions
                          userId={u.id}
                          name={u.full_name ?? u.email}
                          deactivated={Boolean(u.deactivated_at)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/users?page=${page - 1}${params.q ? `&q=${params.q}` : ""}${params.role ? `&role=${params.role}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5"
              >
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={`/admin/users?page=${page + 1}${params.q ? `&q=${params.q}` : ""}${params.role ? `&role=${params.role}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
