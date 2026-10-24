import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunitiesToggle } from "@/components/settings/opportunities-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { PracticePreferences } from "@/components/settings/practice-preferences";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PrivacySettings } from "@/components/settings/privacy-settings";
import { DataManagement } from "@/components/settings/data-management";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { canRenew, getAccess, renewalWindowDays } from "@/lib/subscription";
import { PLANS, rupees } from "@/lib/pricing";
import { formatDay } from "@/lib/utils";
import type { UniversityRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Settings" };

const SHORTCUTS = [
  { keys: "⌘K", label: "Command palette" },
  { keys: "⌘↵", label: "Submit for evaluation" },
  { keys: "esc", label: "Close palette" },
];

export default async function SettingsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/settings");

  const supabase = await createClient();
  const admin = createAdminClientOrNull();
  const [{ data: universities }, access, { data: purchases }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name, short_name, domain, country, created_at")
      .order("name"),
    // The same database checks every gated route uses, so this card can never
    // say "Pro" while the routes say no — or the reverse.
    admin ? getAccess(admin, profile.id) : Promise.resolve(null),
    admin
      ? admin
          .from("purchases")
          .select("id, description, amount_paise, created_at, source")
          .eq("user_id", profile.id)
          .in("status", ["paid", "needs_refund", "refunded"])
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as { id: string; description: string; amount_paise: number; created_at: string; source: string }[] }),
  ]);

  /**
   * The real privacy state, so the toggles open showing what is actually true.
   *
   * These used to render from a default, which meant the panel could show
   * "Show on leaderboard: on" to someone who had switched it off — the setting
   * lived in localStorage and the server had never heard of it.
   *
   * A failed read (a database predating 20250101000028) leaves `privacy` null
   * and the toggles fall back to the defaults, which match the behaviour such a
   * database actually has.
   */
  const { data: privacy } = await supabase
    .from("users")
    .select(
      "show_on_leaderboard, share_history_with_cohort, show_college_affiliation, notify_assignments",
    )
    .eq("id", profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your profile, practice solver options, notifications, privacy, and data.
      </p>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList className="grid grid-cols-3 sm:flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy & Data</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* ---- profile --------------------------------------------------- */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm
                profile={profile}
                universities={(universities ?? []) as UniversityRow[]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- practice -------------------------------------------------- */}
        <TabsContent value="practice" className="mt-6 space-y-6">
          <PracticePreferences />
        </TabsContent>

        {/* ---- workspace ------------------------------------------------- */}
        <TabsContent value="workspace" className="mt-6 space-y-6">
          <AppearanceSettings />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recruiters</CardTitle>
            </CardHeader>
            <CardContent>
              <OpportunitiesToggle
                userId={profile.id}
                initial={profile.open_to_opportunities}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Keyboard shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {shortcut.label}
                  </span>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- notifications --------------------------------------------- */}
        <TabsContent value="notifications" className="mt-6 space-y-6">
          <NotificationSettings
            initial={privacy?.notify_assignments ?? true}
          />
        </TabsContent>

        {/* ---- privacy & data -------------------------------------------- */}
        <TabsContent value="privacy" className="mt-6 space-y-6">
          <PrivacySettings
              initial={{
                showOnLeaderboard: privacy?.show_on_leaderboard ?? true,
                shareHistoryWithCohort: privacy?.share_history_with_cohort ?? true,
                showCollegeAffiliation: privacy?.show_college_affiliation ?? true,
              }}
            />
          <DataManagement userEmail={profile.email} userName={profile.full_name} />
        </TabsContent>

        {/* ---- account --------------------------------------------------- */}
        <TabsContent value="account" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Row label="Email">
                <span className="text-muted-foreground">{profile.email}</span>
              </Row>
              <Row label="Role">
                <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                  {profile.role}
                </Badge>
              </Row>
              <Row label="Member since">
                <span className="text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </Row>
              <p className="pt-2 text-xs text-muted-foreground">
                To change your email address, or to export or delete your
                account and everything in it, email{" "}
                <span className="font-medium text-foreground">
                  chiragpednekar3@gmail.com
                </span>
                . See the{" "}
                <Link
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Privacy Policy
                </Link>{" "}
                for what deletion removes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription & Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Row label="Access">
                <Badge variant={access?.pro ? "default" : "secondary"}>
                  {access?.pro ? "CaseCode Pro" : access?.canSolve ? "Practice (through your college)" : "Reading only"}
                </Badge>
              </Row>
              {access?.subscription && (
                <Row label="Plan">
                  <span className="text-muted-foreground">
                    {PLANS[access.subscription.planCode].name} · until {formatDay(access.subscription.endsAt)}
                    {access.subscription.source === "manual" ? " · granted by CaseCode" : access.subscription.source === "demo" ? " · demo payment" : ""}
                  </span>
                </Row>
              )}
              {access?.queued && (
                <Row label="Next period">
                  <span className="text-muted-foreground">
                    {PLANS[access.queued.planCode].name} from {formatDay(access.queued.startsAt)}
                  </span>
                </Row>
              )}
              {access?.subscription ? (
                canRenew(access.subscription) && !access.queued ? (
                  <div className="space-y-2 rounded-xl bg-card px-4 py-3 shadow-xs dark:shadow-none">
                    <p className="text-xs text-muted-foreground">Your plan is nearly up — the next period starts the day this one ends.</p>
                    <Button variant="ink" size="sm" asChild>
                      <Link href="/upgrade">Renew</Link>
                    </Button>
                  </div>
                ) : !access.queued ? (
                  <p className="text-xs text-muted-foreground">
                    You can renew in the last {renewalWindowDays(access.subscription)} days.{" "}
                    <Link href="/upgrade#topups" className="underline underline-offset-4">Top up</Link> if you run low.
                  </p>
                ) : null
              ) : access?.pro ? (
                <p className="text-xs text-muted-foreground">
                  Pro comes with your account through your college or the CaseCode team — nothing to pay.
                </p>
              ) : (
                <div className="space-y-3 rounded-xl bg-card px-4 py-3 shadow-xs dark:shadow-none">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {access?.canSolve
                      ? "You can practise through your college. Pro adds the AI interviewer and a larger allowance."
                      : "Upgrade to practise: graded answers, drills and AI mock interviews. No college ID needed."}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="ink" size="sm" asChild>
                      <Link href="/upgrade">Upgrade — from {rupees(PLANS.monthly.pricePaise)} a month</Link>
                    </Button>
                    <Link href="/pricing" className="text-xs underline underline-offset-4">
                      Compare plans
                    </Link>
                  </div>
                </div>
              )}
              {(purchases ?? []).length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium">Payments</p>
                  <ul className="mt-2 divide-y divide-border text-xs">
                    {(purchases ?? []).map((p) => (
                      <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5">
                        <Link href={`/purchases/${p.id}`} className="truncate hover:underline">
                          {p.description}
                        </Link>
                        <span className="shrink-0 font-mono text-muted-foreground">
                          {rupees(p.amount_paise)} · {formatDay(p.created_at)}
                          {p.source === "demo" ? " · demo" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Password</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Send yourself a reset link.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/forgot-password">Change password</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}
