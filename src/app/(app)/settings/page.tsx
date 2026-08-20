import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
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
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name, short_name, domain, country, created_at")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your profile, how the app looks, and what it does with your data.
      </p>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
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

        {/* ---- workspace ------------------------------------------------- */}
        <TabsContent value="workspace" className="mt-6 space-y-6">
          <AppearanceSettings />

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
