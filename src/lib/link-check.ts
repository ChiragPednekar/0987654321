import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { isBrokenStatus, type LinkHealth, type OfficialLink } from "@/lib/companies";

type Admin = SupabaseClient<Database>;

/** Per-request budget. A careers site that hangs must not eat the whole run. */
const TIMEOUT_MS = 10_000;

/**
 * Checks every official link on every company profile.
 *
 * These point at firms' own careers pages, which get restructured constantly —
 * one of the 48 was already rotten a day after it was added. A dead link under
 * a heading that says "straight from the firm" costs more credibility than the
 * link ever earned.
 *
 * HEAD first, then GET on anything that refuses HEAD. Plenty of marketing
 * stacks answer HEAD with 405 while serving GET perfectly.
 */
async function check(url: string): Promise<number | null> {
  const attempt = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        // Some careers sites refuse an obviously robotic agent. Identifying
        // ourselves honestly is the right thing to do and also gets a more
        // representative answer than no agent at all.
        headers: { "user-agent": "CaseCode-LinkCheck/1.0 (+https://mableetcode.vercel.app)" },
      });
      return response.status;
    } catch {
      // Aborted, DNS failure, refused connection. Indistinguishable here, and
      // all treated the same: unreachable.
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const head = await attempt("HEAD");
  if (head !== null && head !== 405 && head !== 501) return head;
  return attempt("GET");
}


export interface LinkCheckResult {
  checked: number;
  companies: number;
  broken: { slug: string; url: string; status: number | null }[];
  checkedAt: string;
}

/**
 * Checks every official link on every company profile and records what it saw.
 *
 * Lives here rather than in the route so the weekly run can be driven from the
 * existing daily cron. Vercel's Hobby plan caps how many cron entries a
 * project may declare, and adding a third would have risked failing the whole
 * deploy to schedule a job that runs once a week — not a trade worth making.
 */
export async function checkOfficialLinks(admin: Admin): Promise<LinkCheckResult> {
  const { data: companies, error } = await admin
    .from("companies")
    .select("id, slug, official_links, link_health")
    .not("official_links", "eq", "[]");

  if (error) throw new Error(error.message);

  const checkedAt = new Date().toISOString();
  const broken: LinkCheckResult["broken"] = [];
  let checked = 0;

  for (const company of companies ?? []) {
    const links = (company.official_links ?? []) as OfficialLink[];
    const previous = new Map(
      ((company.link_health ?? []) as LinkHealth[]).map((h) => [h.url, h]),
    );

    const health: LinkHealth[] = [];
    for (const link of links) {
      const status = await check(link.url);
      checked++;

      /**
       * Consecutive failures, not a running total. A link that 404s tonight
       * and answers tomorrow goes back to zero — which is right, because it
       * is working.
       */
      const failures = isBrokenStatus(status)
        ? (previous.get(link.url)?.failures ?? 0) + 1
        : 0;

      health.push({ url: link.url, status, checked_at: checkedAt, failures });
      if (failures >= 2) broken.push({ slug: company.slug, url: link.url, status });
    }

    const { error: writeError } = await admin
      .from("companies")
      .update({ link_health: health })
      .eq("id", company.id);

    if (writeError) {
      console.error(`[link-check] could not store health for ${company.slug}`, writeError.message);
    }
  }

  if (broken.length > 0) {
    // The page hides a confirmed-dead link on its own, but somebody still has
    // to go and find the new URL.
    console.error(
      `[link-check] ${broken.length} official link(s) confirmed dead:`,
      broken.map((b) => `${b.slug} ${b.url} (${b.status ?? "unreachable"})`).join("; "),
    );
  }

  return { checked, companies: companies?.length ?? 0, broken, checkedAt };
}
