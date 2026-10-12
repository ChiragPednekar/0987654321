"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

/** Browser client. Carries the user's session; every query is under RLS. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: SESSION_COOKIE_OPTIONS },
  );
}
