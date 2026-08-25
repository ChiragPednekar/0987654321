import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Cpu, IndianRupee, TrendingUp, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { LicenceForm } from "@/components/admin/licence-form";
import { LicenceControls } from "@/components/admin/licence-controls";
import { MODEL_RATES, QUOTA } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import type {
  InstitutionCommercialsRow,
  InstitutionRow,
} from "@/lib/types/database";

export const metadata: Metadata = { title: "Licence" };

function rupees(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default async function LicenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/admin/licences/${id}`);
  if (profile.role !== "admin") redirect("/dashboard");

  const admin = createAdminClientOrNull();
  if (!admin) redirect("/admin");

  const { data: institution } = await admin
    .from("institutions")
    .select("*")
    .eq("id", id)
    .maybeSingle<InstitutionRow>();

  if (!institution) notFound();

  const [{ data: commercials }, { data: staff }] = await Promise.all([
    admin.rpc("institution_commercials", {
      p_in_rate_per_million: MODEL_RATES.inputPerMillionUsd,
      p_out_rate_per_million: MODEL_RATES.outputPerMillionUsd,
      p_usd_inr: MODEL_RATES.usdInr,
    }),
    admin
      .from("institution_members")
      .select("user_id, role, joined_at, users(full_name, email)")
      .eq("institution_id", id)
      .in("role", ["owner", "staff"]),
  ]);

  const row = ((commercials ?? []) as InstitutionCommercialsRow[]).find(
    (r) => r.institution_id === id,
  );

  const value = institution.contract_value_inr ?? 0;
  const aiCost = Number(row?.ai_cost_inr ?? 0);
  const margin = value > 0 ? (value - aiCost) / value : null;

  const seatsUsed = Number(row?.seats_used ?? 0);
  const gradings = Number(row?.gradings ?? 0);
  const interviews = Number(row?.interviews ?? 0);

  // What this contract could cost if every seat used its full allowance —
  // the number that decides whether the price is safe.
  const gradingCap = institution.grading_quota ?? QUOTA.pro.gradings;
  const interviewCap = institution.interview_quota ?? QUOTA.pro.interviews;
  const worstCase =
    institution.seats_licensed * (gradingCap * 0.72 + interviewCap * 2.16);
  const worstMargin = value > 0 ? (value - worstCase) / value : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/licences"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Licences
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {institution.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {institution.email_domain
              ? `@${institution.email_domain}`
              : "invite only"}
            {institution.licence_ends_on
              ? ` · ends ${institution.licence_ends_on}`
              : " · open-ended"}
          </p>
        </div>
        <LicenceControls
          institutionId={institution.id}
          isSuspended={institution.is_suspended}
          name={institution.name}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Seats"
          value={`${formatNumber(seatsUsed)} / ${formatNumber(institution.seats_licensed)}`}
          sublabel={`${formatNumber(Number(row?.active_30d ?? 0))} active in 30d`}
          icon={Users}
        />
        <StatCard label="Contract" value={rupees(value)} sublabel="excl. GST" icon={IndianRupee} />
        <StatCard
          label="AI cost"
          value={rupees(aiCost)}
          sublabel={`${formatNumber(gradings)} graded · ${formatNumber(interviews)} interviews`}
          icon={Cpu}
        />
        <StatCard
          label="Margin"
          value={margin === null ? "—" : `${(margin * 100).toFixed(0)}%`}
          sublabel="on usage so far"
          icon={TrendingUp}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Worst case</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            If every one of {formatNumber(institution.seats_licensed)} seats used
            its full allowance ({gradingCap} graded answers, {interviewCap}{" "}
            interviews) this contract would cost{" "}
            <strong className="text-foreground">{rupees(worstCase)}</strong> in
            model spend.
          </p>
          {worstMargin !== null ? (
            <p className={worstMargin < 0.3 ? "text-amber-600 dark:text-amber-400" : ""}>
              That is a guaranteed floor of{" "}
              <strong>{(worstMargin * 100).toFixed(0)}%</strong> margin.
              {worstMargin < 0.3
                ? " Thin — consider a higher price or a lower allowance."
                : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Set an annual value to see the guaranteed margin.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Placement staff</CardTitle>
        </CardHeader>
        <CardContent>
          {!staff || staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff yet — nobody at this college can see their dashboard.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {staff.map((m) => {
                const u = Array.isArray(m.users) ? m.users[0] : m.users;
                return (
                  <li key={m.user_id} className="flex items-center justify-between">
                    <span>
                      {u?.full_name ?? "Unnamed"}{" "}
                      <span className="text-muted-foreground">{u?.email}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{m.role}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Contract terms</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <LicenceForm initial={institution} />
        </CardContent>
      </Card>
    </div>
  );
}
