import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LicenceForm } from "@/components/admin/licence-form";

export const metadata: Metadata = { title: "New licence" };

export default async function NewLicencePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/admin/licences/new");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/licences"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Licences
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New licence</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A campus contract: who it is for, how many seats, what they pay.
      </p>
      <Card className="mt-6">
        <CardContent className="p-6">
          <LicenceForm />
        </CardContent>
      </Card>
    </div>
  );
}
