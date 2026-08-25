"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUOTA } from "@/lib/constants";
import type { InstitutionRow } from "@/lib/types/database";

/**
 * Create or edit a campus licence.
 *
 * Every field here is a contract term, which is why none of them are editable
 * by the college itself — seats, dates and quota all live behind the
 * platform-admin API.
 */
export function LicenceForm({ initial }: { initial?: InstitutionRow }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const editing = Boolean(initial);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);

    const num = (k: string) => {
      const v = String(f.get(k) ?? "").trim();
      return v === "" ? null : Number(v);
    };
    const str = (k: string) => {
      const v = String(f.get(k) ?? "").trim();
      return v === "" ? null : v;
    };

    const payload = {
      name: String(f.get("name") ?? "").trim(),
      email_domain: str("email_domain")?.toLowerCase().replace(/^@/, "") ?? null,
      seats_licensed: num("seats_licensed") ?? 0,
      licence_starts_on: str("licence_starts_on"),
      licence_ends_on: str("licence_ends_on"),
      contract_value_inr: num("contract_value_inr"),
      billing_contact_email: str("billing_contact_email"),
      grading_quota: num("grading_quota"),
      interview_quota: num("interview_quota"),
      grants_pro: f.get("grants_pro") === "on",
      notes: str("notes"),
      ...(editing ? {} : { staff_email: str("staff_email") ?? undefined }),
    };

    try {
      const response = await fetch(
        editing ? `/api/admin/institutions/${initial!.id}` : "/api/admin/institutions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not save the licence.");
        return;
      }
      toast.success(editing ? "Licence updated." : "Licence created.");
      router.push(`/admin/licences/${editing ? initial!.id : body.id}`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-medium">Institution</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name" name="name" required minLength={2} maxLength={160}
              defaultValue={initial?.name}
              placeholder="Indian Institute of Management, Bangalore"
            />
          </div>
          <div>
            <Label htmlFor="email_domain">Email domain</Label>
            <Input
              id="email_domain" name="email_domain"
              defaultValue={initial?.email_domain ?? ""}
              placeholder="iimb.ac.in"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Students signing up on this domain enrol automatically. Leave
              blank for invite-only.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Contract</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="seats_licensed">Seats licensed</Label>
            <Input
              id="seats_licensed" name="seats_licensed" type="number" min={0}
              defaultValue={initial?.seats_licensed ?? 1000}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              0 means unlimited. Past the cap, signups still work but do not
              enrol.
            </p>
          </div>
          <div>
            <Label htmlFor="contract_value_inr">Annual value (₹)</Label>
            <Input
              id="contract_value_inr" name="contract_value_inr" type="number" min={0}
              defaultValue={initial?.contract_value_inr ?? ""}
              placeholder="500000"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Excluding GST. Drives the margin column.
            </p>
          </div>
          <div>
            <Label htmlFor="licence_starts_on">Starts</Label>
            <Input
              id="licence_starts_on" name="licence_starts_on" type="date"
              defaultValue={initial?.licence_starts_on ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="licence_ends_on">Ends</Label>
            <Input
              id="licence_ends_on" name="licence_ends_on" type="date"
              defaultValue={initial?.licence_ends_on ?? ""}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Access stops on its own the day after. No cron job involved.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="billing_contact_email">Billing contact</Label>
            <Input
              id="billing_contact_email" name="billing_contact_email" type="email"
              defaultValue={initial?.billing_contact_email ?? ""}
              placeholder="accounts@iimb.ac.in"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Allowance</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="grading_quota">Graded answers / student / year</Label>
            <Input
              id="grading_quota" name="grading_quota" type="number" min={0}
              defaultValue={initial?.grading_quota ?? ""}
              placeholder={String(QUOTA.pro.gradings)}
            />
          </div>
          <div>
            <Label htmlFor="interview_quota">Interviews / student / year</Label>
            <Input
              id="interview_quota" name="interview_quota" type="number" min={0}
              defaultValue={initial?.interview_quota ?? ""}
              placeholder={String(QUOTA.pro.interviews)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Blank uses the platform default ({QUOTA.pro.gradings} and{" "}
          {QUOTA.pro.interviews}), which caps worst-case model spend at about
          ₹288 per student per year. Raise these only against a contract that
          pays for it.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox" name="grants_pro" className="size-4"
            defaultChecked={initial ? initial.grants_pro : true}
          />
          Licence grants Pro (the live interviewer) to members
        </label>
      </section>

      {!editing ? (
        <section className="space-y-2">
          <Label htmlFor="staff_email">Placement-cell contact</Label>
          <Input
            id="staff_email" name="staff_email" type="email"
            placeholder="placement@iimb.ac.in"
          />
          <p className="text-xs text-muted-foreground">
            Gets staff access to the placement dashboard. Only works if they
            already have an account — otherwise add them afterwards.
          </p>
        </section>
      ) : null}

      <section>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes" name="notes" rows={3}
          defaultValue={initial?.notes ?? ""}
          placeholder="PO number, procurement contact, renewal terms…"
        />
      </section>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {editing ? "Save changes" : "Create licence"}
      </Button>
    </form>
  );
}
