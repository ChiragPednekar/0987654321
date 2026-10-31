import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { SignInScreen } from "@/components/auth/sign-in/sign-in-screen";
import { googleSignInEnabled } from "@/lib/auth-providers";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The editorial italic under the sign-in headline. Loaded here rather than in
 * the root layout: no other page uses it. Exposed as --font-newsreader for
 * `.signin-serif` in globals.css.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
  display: "swap",
});

/**
 * Sign-in lives outside the (auth) group so it can own the whole screen; the
 * sign-up and password pages keep the card layout there.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const profile = await getCurrentUser();
  const googleEnabled = await googleSignInEnabled();
  // A path on this site only: "//host" and "/\host" are other origins.
  const next =
    params.next?.startsWith("/") && !/^\/[/\\]/.test(params.next)
      ? params.next
      : "/dashboard";

  return (
    <div className={newsreader.variable}>
      <SignInScreen
        next={next}
        googleEnabled={googleEnabled}
        signedInEmail={profile?.email ?? null}
        error={params.error ?? null}
        year={new Date().getFullYear()}
      />
    </div>
  );
}
