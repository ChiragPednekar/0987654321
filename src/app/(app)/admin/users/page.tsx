import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserFilters } from "@/components/admin/user-filters";
import { UserActions } from "@/components/admin/user-actions";
import { formatNumber, timeAgo } from "@/lib/utils";
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
  const deactivated = rows.filter((u) => u.deactivated_at).length;
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNumber(Number(total))} accounts
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
                          <Badge variant="secondary" className="ml-1">Pro</Badge>
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
