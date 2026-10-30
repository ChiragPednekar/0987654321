import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, Search } from "lucide-react";
import { Page, PageHeader } from "@/components/page-header";
import { StatChip, StatChipRow } from "@/components/stat-chip";
import { DifficultySignal } from "@/components/difficulty-signal";
import { TrackCard } from "@/components/track-card";
import { EmptyState } from "@/components/empty-state";
import { GhostCard } from "@/components/ghost-card";
import { DateBlock } from "@/components/date-block";
import { RankBadge } from "@/components/rank-badge";
import { UserAvatar } from "@/components/user-avatar";
import { CaseTags } from "@/components/case-tags";
import { ILLUSTRATIONS, IllustrationTile } from "@/components/illustrations";
import { Kbd, ShortcutKbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { Section, SectionList } from "@/components/section";
import { greetingFor } from "@/lib/greeting";

/**
 * A gallery of the shared page primitives, for reviewing them in light and
 * dark before they go onto real pages. Development only.
 */
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Page>
      <PageHeader
        eyebrow="Dashboard"
        title={
          <>
            {greetingFor()}, <span className="text-brand">Chirag</span>.
          </>
        }
        subtitle="Pick up where you left off, or start something new."
        stats={[{ value: 6, label: "tracks" }, { value: 214, label: "cases" }, { value: 9, label: "finished" }]}
        actions={
          <Button size="lg">
            Solve a case <ArrowRight />
          </Button>
        }
      />

      <StatChipRow className="mt-6">
        <StatChip label="Streak" value={12} unit="days" tone="warning" />
        <StatChip label="Cases solved" value={48} tone="brand" />
        <StatChip label="Average score" value="7.4" unit="/ 10" tone="success" />
        <StatChip label="College rank" value="#14" tone="highlight" />
        <StatChip label="Interview readiness" value="68%" tone="info" />
      </StatChipRow>

      <Section title="Tracks" count={4} description="Equal heights, whatever each card has to say.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TrackCard
            href="#"
            title="Profitability"
            illustration="barChart"
            solved={4}
            total={25}
            forYourGoal
            next={{ title: "Coffee chain profitability decline", href: "#" }}
          />
          <TrackCard
            href="#"
            title="Market entry"
            description="Should we enter, how, and when. Sizing, competition and the entry mode."
            illustration="flag"
            solved={0}
            total={18}
            next={{ title: "EV charging in tier-2 cities", href: "#" }}
          />
          <TrackCard href="#" title="Pricing" illustration="priceTag" solved={12} total={12} />
          <GhostCard href="#" label="Add a target company" description="Get a track of that firm's interview style." />
        </div>
      </Section>

      <Section title="Cases" description="Difficulty, category and tags on one row.">
        <SectionList>
          {[
            { title: "Coffee chain profitability decline", d: "easy", cat: "Retail", tags: ["profitability", "cost-to-serve", "margin"] },
            { title: "EV charging in tier-2 cities", d: "medium", cat: "Energy", tags: ["market-entry", "sizing", "gtm"] },
            { title: "Regional bank acquires a fintech lender", d: "hard", cat: "Financial services", tags: ["m&a", "synergies", "wacc", "valuation"] },
          ].map((c) => (
            <li key={c.title} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <CaseTags category={c.cat} tags={c.tags} className="mt-0.5" />
              </div>
              <DifficultySignal difficulty={c.d as "easy" | "medium" | "hard"} />
            </li>
          ))}
        </SectionList>
      </Section>

      <Section title="Leaderboard" description="Fixed row height with or without a college line.">
        <SectionList>
          {[
            { id: "a1", name: "Chirag Yogesh Pednekar", college: "IIM Lucknow", score: 2480 },
            { id: "b2", name: "Asha Raman", college: null, score: 2315 },
            { id: "c3", name: "Rohit Menon", college: "XLRI Jamshedpur", score: 2290 },
            { id: "d4", name: "Neha", college: "FMS Delhi", score: 2104 },
          ].map((u, i) => (
            <li key={u.id} className="flex h-16 items-center gap-3">
              <RankBadge rank={i + 1 === 4 ? 14 : i + 1} />
              <UserAvatar id={u.id} name={u.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{u.name}</p>
                <p className="truncate text-[13px] leading-tight text-muted-foreground">{u.college ?? " "}</p>
              </div>
              <span className="font-semibold tabular">{u.score.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </SectionList>
      </Section>

      <Section title="Competitions" description="Upcoming first, past newest first.">
        <SectionList>
          {[
            { date: "2026-11-14T12:30:00Z", title: "Campus case challenge, round 1", meta: "6 cases · 214 registered" },
            { date: "2026-11-28T12:30:00Z", title: "Product sense sprint", meta: "4 cases · 96 registered" },
          ].map((e) => (
            <li key={e.title} className="flex items-center gap-4 py-3">
              <DateBlock date={e.date} />
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="text-[13px] text-muted-foreground tabular">{e.meta}</p>
              </div>
            </li>
          ))}
        </SectionList>
      </Section>

      <Section title="Empty state" description="One size on every page.">
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Your teacher hasn't set any cases for this batch. They'll show up here when they do."
          action={<Button variant="secondary">Browse cases</Button>}
        />
      </Section>

      <Section title="Search and keys">
        <div className="flex max-w-md items-center gap-2 rounded-[10px] border border-input bg-card px-3 py-2 text-muted-foreground">
          <Search className="size-4" />
          <span className="flex-1 text-[15px]">Search cases, companies, frameworks</span>
          <ShortcutKbd keys={["K"]} />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          Submit answer <ShortcutKbd keys={["↵"]} /> · Search settings <Kbd>/</Kbd>
        </p>
      </Section>

      <Section title="Illustrations">
        <div className="flex flex-wrap gap-3">
          {ILLUSTRATIONS.map((name) => (
            <figure key={name} className="flex flex-col items-center gap-1.5">
              <IllustrationTile name={name} />
              <figcaption className="text-[11px] text-muted-foreground">{name}</figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </Page>
  );
}
