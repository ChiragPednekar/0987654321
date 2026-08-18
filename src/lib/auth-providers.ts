import "server-only";

/**
 * Whether Supabase actually has the Google provider turned on.
 *
 * The sign-in button used to be gated on a hand-maintained env flag, which
 * drifts: v1 shipped the button against a provider that was never configured,
 * so the first thing on the login page was guaranteed to fail. Asking the auth
 * server directly means the button can only appear when the provider is really
 * there.
 *
 * Note this reports what the provider config says, not whether the credentials
 * behind it are valid — an enabled provider with an empty client id still
 * reports true.
 */
export async function googleSignInEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      // Provider config changes rarely; don't pay for it on every render.
      next: { revalidate: 300 },
    });

    if (!response.ok) return false;

    const settings: { external?: Record<string, boolean> } =
      await response.json();
    return Boolean(settings.external?.google);
  } catch {
    // A login page that renders without the button beats one that 500s.
    return false;
  }
}
