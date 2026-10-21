/**
 * Seeds negotiation exercises.
 *
 *   npm run seed:negotiations
 *
 * Every case is built so that the two sides rank the issues differently. That
 * is the whole design: if both wanted the same thing in the same order there
 * would be nothing to trade and the exercise would be haggling over one
 * number. The payoff tables are checked below to make sure each case actually
 * has value waiting to be found.
 *
 * Idempotent on slug.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { maxJointValue, type NegotiationSetup } from "../src/lib/negotiation/engine";

config({ path: ".env.local" });
config({ path: ".env" });

type Case = {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  shared_brief: string;
  student_role: string;
  counterparty_role: string;
  student_brief: string;
  counterparty_brief: string;
  issues: { key: string; label: string; options: { key: string; label: string }[] }[];
  student_payoffs: Record<string, Record<string, number>>;
  counterparty_payoffs: Record<string, Record<string, number>>;
  student_batna: number;
  counterparty_batna: number;
};

export const CASES: Case[] = [
  {
    slug: "supplier-contract-renewal",
    title: "Renewing a components contract",
    difficulty: "medium",
    shared_brief:
      "Vardhan Industries has bought moulded components from Kesari Polymers for four years. The contract is up for renewal and both sides want to continue, but on better terms than last time. Four things are open: unit price, payment terms, a volume commitment, and who holds buffer stock.",
    student_role: "Procurement lead at Vardhan Industries (the buyer)",
    counterparty_role: "Sales head at Kesari Polymers (the seller)",
    student_brief:
      "Your CFO has told you to get the landed cost down — price is what your performance is judged on this year. Your plant has space, so holding buffer stock yourself costs you little. You would prefer not to commit to volume, but it is not what you will be measured on.",
    counterparty_brief:
      "You are the sales head at Kesari Polymers. Your factory has just been expanded and the board is judging you on capacity utilisation, so a firm volume commitment is worth more to you than anything else in this deal — it lets you plan production and stop chasing spot orders. You can be flexible on price if you get it.\n\nYour cash position is comfortable, so payment terms are a secondary concern, though sooner is better. Holding buffer stock is genuinely expensive for you: your warehouse is full and you would have to rent space.\n\nDo not volunteer that the volume commitment is what you care about. If the buyer asks what matters most to you, you may say that certainty of demand helps you, but make them trade for it.",
    issues: [
      {
        key: "price",
        label: "Unit price",
        options: [
          { key: "p88", label: "₹88" },
          { key: "p94", label: "₹94" },
          { key: "p100", label: "₹100" },
        ],
      },
      {
        key: "terms",
        label: "Payment terms",
        options: [
          { key: "d30", label: "30 days" },
          { key: "d60", label: "60 days" },
          { key: "d90", label: "90 days" },
        ],
      },
      {
        key: "volume",
        label: "Volume commitment",
        options: [
          { key: "none", label: "No commitment" },
          { key: "half", label: "60% of last year, committed" },
          { key: "full", label: "100% of last year, committed" },
        ],
      },
      {
        key: "buffer",
        label: "Who holds buffer stock",
        options: [
          { key: "buyer", label: "Vardhan holds it" },
          { key: "seller", label: "Kesari holds it" },
        ],
      },
    ],
    student_payoffs: {
      price: { p88: 36, p94: 22, p100: 6 },
      terms: { d30: 4, d60: 12, d90: 20 },
      volume: { none: 14, half: 9, full: 4 },
      buffer: { buyer: 6, seller: 12 },
    },
    counterparty_payoffs: {
      price: { p88: 8, p94: 18, p100: 28 },
      terms: { d30: 16, d60: 10, d90: 3 },
      volume: { none: 2, half: 20, full: 34 },
      buffer: { buyer: 16, seller: 2 },
    },
    student_batna: 40,
    counterparty_batna: 42,
  },
  {
    slug: "first-job-offer",
    title: "Negotiating your first offer",
    difficulty: "easy",
    shared_brief:
      "You have an offer from a mid-sized consulting firm. HR has asked you to come back with what it would take to sign. Four things are negotiable: base salary, joining bonus, the start date, and which office you are based in.",
    student_role: "The candidate",
    counterparty_role: "HR business partner at the firm",
    student_brief:
      "You want the money, but you also have a family reason to be in Pune rather than Gurgaon, and you would like six weeks before starting. You have one other offer that is slightly worse overall — real, but not one you want to use as a threat unless you have to.",
    counterparty_brief:
      "You are the HR business partner. Your salary bands are tight and going above the mid-point needs an approval you would rather not ask for, so base salary is where you are least flexible. A joining bonus comes from a different budget and is far easier for you to give.\n\nYou need bodies in Gurgaon — that is where the staffing gap is — so the office matters to you more than the candidate is likely to guess. A later start date is mildly inconvenient but survivable.\n\nBe warm and professional. Do not reveal that the joining bonus is cheap for you, and do not volunteer how badly you need Gurgaon. If the candidate asks directly what is easiest for you to move, you may say the bonus is more flexible than base.",
    issues: [
      {
        key: "base",
        label: "Base salary",
        options: [
          { key: "b18", label: "₹18 lakh" },
          { key: "b20", label: "₹20 lakh" },
          { key: "b22", label: "₹22 lakh" },
        ],
      },
      {
        key: "bonus",
        label: "Joining bonus",
        options: [
          { key: "none", label: "None" },
          { key: "two", label: "₹2 lakh" },
          { key: "four", label: "₹4 lakh" },
        ],
      },
      {
        key: "start",
        label: "Start date",
        options: [
          { key: "soon", label: "In 2 weeks" },
          { key: "six", label: "In 6 weeks" },
        ],
      },
      {
        key: "office",
        label: "Base office",
        options: [
          { key: "pune", label: "Pune" },
          { key: "gurgaon", label: "Gurgaon" },
        ],
      },
    ],
    student_payoffs: {
      base: { b18: 6, b20: 16, b22: 26 },
      bonus: { none: 2, two: 10, four: 18 },
      start: { soon: 3, six: 12 },
      office: { pune: 20, gurgaon: 4 },
    },
    counterparty_payoffs: {
      base: { b18: 28, b20: 16, b22: 4 },
      bonus: { none: 14, two: 10, four: 5 },
      start: { soon: 12, six: 6 },
      office: { pune: 3, gurgaon: 26 },
    },
    student_batna: 38,
    counterparty_batna: 40,
  },
  {
    slug: "distribution-partnership",
    title: "Entering a new state through a distributor",
    difficulty: "hard",
    shared_brief:
      "A packaged foods brand wants to enter Tamil Nadu and is talking to an established regional distributor. Four things are open: the distributor's margin, whether the territory is exclusive, who funds in-store promotion, and how long the initial term runs.",
    student_role: "National sales head at the brand",
    counterparty_role: "Owner of the regional distributor",
    student_brief:
      "Your board has approved the entry but not a large promotion budget, so funding in-store activity yourself would hurt. You are wary of exclusivity because it is hard to undo. Margin matters but you have some room. A long term is fine if the rest is right.",
    counterparty_brief:
      "You own the distributor. You have seen national brands enter, take your shelf relationships, and then appoint a second distributor two years later — so exclusivity and a long term are what actually protect you, and they matter far more to you than a point or two of margin.\n\nYou have your own promoter team already on payroll, so funding in-store promotion costs you much less than the brand probably assumes.\n\nYou are a shrewd, experienced negotiator. Open by pressing hard on margin, because that is what brands expect you to care about — but what you must not leave without is exclusivity and a term of at least three years. Do not explain why.",
    issues: [
      {
        key: "margin",
        label: "Distributor margin",
        options: [
          { key: "m8", label: "8%" },
          { key: "m11", label: "11%" },
          { key: "m14", label: "14%" },
        ],
      },
      {
        key: "exclusive",
        label: "Territory exclusivity",
        options: [
          { key: "no", label: "Non-exclusive" },
          { key: "yes", label: "Exclusive" },
        ],
      },
      {
        key: "promo",
        label: "In-store promotion funding",
        options: [
          { key: "brand", label: "Brand funds it" },
          { key: "split", label: "Split 50/50" },
          { key: "dist", label: "Distributor funds it" },
        ],
      },
      {
        key: "term",
        label: "Initial term",
        options: [
          { key: "one", label: "1 year" },
          { key: "three", label: "3 years" },
          { key: "five", label: "5 years" },
        ],
      },
    ],
    student_payoffs: {
      margin: { m8: 24, m11: 15, m14: 5 },
      exclusive: { no: 14, yes: 6 },
      promo: { brand: 2, split: 12, dist: 24 },
      term: { one: 10, three: 9, five: 7 },
    },
    counterparty_payoffs: {
      margin: { m8: 6, m11: 13, m14: 20 },
      exclusive: { no: 2, yes: 26 },
      promo: { brand: 14, split: 10, dist: 5 },
      term: { one: 2, three: 18, five: 24 },
    },
    student_batna: 40,
    counterparty_batna: 44,
  },  {
    slug: "cafe-lease-renewal",
    title: "Renewing the lease on your café",
    difficulty: "easy",
    shared_brief:
      "You run a 40-seat café on a busy street in Bengaluru. The three-year lease is ending and the landlord has asked you to sign a renewal. Four things are open: the monthly rent, the lock-in period, the yearly rent escalation, and whether the landlord contributes to repairs the premises badly need.",
    student_role: "Owner of the café (the tenant)",
    counterparty_role: "Owner of the building (the landlord)",
    student_brief:
      "Cash is tight, so the monthly rent is what matters most to you. The kitchen needs about ₹6 lakh of work — wiring, drainage and the exhaust — and you cannot fund it yourself this year, so any contribution from the landlord is worth a great deal. You have built a regular crowd here and would happily stay longer, but you would not lock yourself in at any price. A lower yearly escalation helps, but less than the rent itself.",
    counterparty_brief:
      "You own the building. You took a loan against the property last year and a long, locked-in tenant is what your bank and your peace of mind need — a vacant shop for three months would hurt you far more than a few thousand rupees of rent. The rent matters, but it is not your top priority.\n\nYour brother-in-law is a contractor, so repairs cost you much less than they would cost the tenant — about half. You would still rather not pay for them, and you should not volunteer that they are cheap for you.\n\nOpen by asking for a rent increase. If the tenant asks what matters to you, you may say you want a tenant who will stay, but make them offer something for it.",
    issues: [
      { key: "rent", label: "Monthly rent", options: [ { key: "r80", label: "₹80,000" }, { key: "r90", label: "₹90,000" }, { key: "r100", label: "₹1,00,000" } ] },
      { key: "lockin", label: "Lock-in period", options: [ { key: "l1", label: "1 year" }, { key: "l3", label: "3 years" }, { key: "l5", label: "5 years" } ] },
      { key: "escalation", label: "Yearly rent escalation", options: [ { key: "low", label: "5% a year" }, { key: "high", label: "8% a year" } ] },
      { key: "repairs", label: "Landlord's contribution to repairs", options: [ { key: "none", label: "None" }, { key: "half", label: "₹3 lakh" }, { key: "full", label: "₹6 lakh" } ] },
    ],
    student_payoffs: {
      rent: { r80: 34, r90: 20, r100: 6 },
      lockin: { l1: 4, l3: 10, l5: 14 },
      escalation: { low: 14, high: 4 },
      repairs: { none: 0, half: 14, full: 24 },
    },
    counterparty_payoffs: {
      rent: { r80: 6, r90: 18, r100: 28 },
      lockin: { l1: 2, l3: 18, l5: 30 },
      escalation: { low: 6, high: 14 },
      repairs: { none: 12, half: 9, full: 6 },
    },
    student_batna: 40,
    counterparty_batna: 42,
  },
  {
    slug: "freelance-design-project",
    title: "Pricing a freelance design project",
    difficulty: "easy",
    shared_brief:
      "You are a freelance designer. A seed-funded fintech startup wants you to design the screens for its new app. Four things are open: the fee, the deadline, how many rounds of revisions are included, and whether you can show the work in your portfolio.",
    student_role: "Freelance designer",
    counterparty_role: "Founder of the startup",
    student_brief:
      "The fee matters, but you are building a reputation: a case study of a real fintech app on your site would bring you more clients than this project pays. Unlimited revisions is how freelancers lose money, so you want a limit. A tight deadline would mean turning away other work. You have another project you could take instead, paying a little less.",
    counterparty_brief:
      "You are the founder. You have a demo for investors in five weeks, so the deadline is what matters most to you — two weeks would be ideal. Your runway is short, so a lower fee helps too. You would like as many revisions as possible because your co-founder keeps changing their mind.\n\nYou do not really mind the designer showing the work after launch — it is good publicity for you. You would prefer it stayed confidential before launch, but only mildly. Do not volunteer that portfolio rights are cheap for you; if asked, say you would need to think about it.",
    issues: [
      { key: "fee", label: "Project fee", options: [ { key: "f60", label: "₹60,000" }, { key: "f90", label: "₹90,000" }, { key: "f120", label: "₹1,20,000" } ] },
      { key: "deadline", label: "Delivery deadline", options: [ { key: "w2", label: "2 weeks" }, { key: "w4", label: "4 weeks" }, { key: "w6", label: "6 weeks" } ] },
      { key: "revisions", label: "Revisions included", options: [ { key: "unlimited", label: "Unlimited" }, { key: "three", label: "Three rounds" }, { key: "one", label: "One round" } ] },
      { key: "credit", label: "Portfolio rights", options: [ { key: "none", label: "Confidential, no portfolio use" }, { key: "after", label: "Portfolio use after launch" }, { key: "case", label: "Full case study with credit" } ] },
    ],
    student_payoffs: {
      fee: { f60: 6, f90: 18, f120: 30 },
      deadline: { w2: 2, w4: 12, w6: 16 },
      revisions: { unlimited: 0, three: 12, one: 16 },
      credit: { none: 0, after: 14, case: 22 },
    },
    counterparty_payoffs: {
      fee: { f60: 28, f90: 18, f120: 6 },
      deadline: { w2: 26, w4: 16, w6: 2 },
      revisions: { unlimited: 14, three: 10, one: 3 },
      credit: { none: 8, after: 7, case: 5 },
    },
    student_batna: 32,
    counterparty_batna: 34,
  },
  {
    slug: "fest-title-sponsorship",
    title: "Closing a title sponsor for the college fest",
    difficulty: "medium",
    shared_brief:
      "You head sponsorship for your B-school's annual fest, which draws about 8,000 visitors over three days. A consumer electronics brand is interested in sponsoring it. Four things are open: the sponsorship amount, how the brand is named on the fest, the number of stalls it gets, and whether it is the only electronics brand at the fest.",
    student_role: "Head of sponsorship for the fest",
    counterparty_role: "Brand manager at the electronics company",
    student_brief:
      "The fest budget has a hole that only a large sponsorship fills, so the amount matters most. The alumni committee is against renaming the fest after a brand — 'Brand presents' is tolerable, the brand's name in the title is not. Stall space is easy for you to give. You already have a smaller electronics brand interested in a minor sponsorship, so category exclusivity would cost you that deal. You have a fallback sponsor at a lower amount.",
    counterparty_brief:
      "You are the brand manager. You are launching a new line of earbuds aimed at students, and what you need is visibility and the chance to put the product in students' hands — so naming prominence and stalls with a demo zone matter more to you than the amount, which is within your budget either way, though lower is better.\n\nYou also do not want a rival electronics brand at the same fest; exclusivity is important to your manager.\n\nOpen by offering a low amount. Do not reveal that the amount is comfortably within budget. If the student asks what would make the deal more valuable to you, you may say visibility and product trials.",
    issues: [
      { key: "amount", label: "Sponsorship amount", options: [ { key: "a4", label: "₹4 lakh" }, { key: "a6", label: "₹6 lakh" }, { key: "a8", label: "₹8 lakh" } ] },
      { key: "naming", label: "Naming", options: [ { key: "posters", label: "Logo on posters only" }, { key: "presents", label: "\"Brand presents the fest\"" }, { key: "title", label: "Brand name in the fest's title" } ] },
      { key: "stalls", label: "Stalls", options: [ { key: "one", label: "One stall" }, { key: "three", label: "Three stalls and a demo zone" } ] },
      { key: "exclusive", label: "Category exclusivity", options: [ { key: "no", label: "Other electronics brands allowed" }, { key: "yes", label: "Only electronics brand at the fest" } ] },
    ],
    student_payoffs: {
      amount: { a4: 8, a6: 22, a8: 36 },
      naming: { posters: 12, presents: 8, title: 2 },
      stalls: { one: 6, three: 4 },
      exclusive: { no: 14, yes: 4 },
    },
    counterparty_payoffs: {
      amount: { a4: 28, a6: 18, a8: 6 },
      naming: { posters: 2, presents: 14, title: 20 },
      stalls: { one: 4, three: 18 },
      exclusive: { no: 2, yes: 16 },
    },
    student_batna: 34,
    counterparty_batna: 36,
  },
  {
    slug: "it-services-bank-contract",
    title: "Winning an IT services contract with a bank",
    difficulty: "medium",
    shared_brief:
      "Your IT services firm is the preferred bidder to run a private bank's loan-processing applications. The commercial terms are being negotiated. Four things are open: the blended hourly rate, the length of the contract, the cap on service-level penalties, and the share of the work done offshore.",
    student_role: "Account director at the IT services firm",
    counterparty_role: "Head of IT procurement at the bank",
    student_brief:
      "Your margin depends far more on how much of the work is done offshore than on the headline rate: offshore delivery costs a fraction of onsite. A long contract lets you invest in the team and is valued by your leadership. You want penalties capped low, because one bad month should not wipe out a quarter's margin. The rate matters, but your pricing committee has given you some room on it.",
    counterparty_brief:
      "You head IT procurement at the bank. You are measured on cost, so the rate matters most to you. Your risk committee wants the vendor to be accountable, so a meaningful penalty cap matters a lot — a 5% cap would look weak to them.\n\nYou prefer a three-year term: one year means re-tendering too soon, five years feels like lock-in. On offshore work you have some concerns about data handling, but your information security team has already approved offshore delivery from certified centres, so a higher offshore share is acceptable to you — less important than the vendor probably assumes.\n\nDo not volunteer that offshore delivery is already approved. Push on rate first.",
    issues: [
      { key: "rate", label: "Blended hourly rate", options: [ { key: "r2400", label: "₹2,400" }, { key: "r2800", label: "₹2,800" }, { key: "r3200", label: "₹3,200" } ] },
      { key: "term", label: "Contract length", options: [ { key: "y1", label: "1 year" }, { key: "y3", label: "3 years" }, { key: "y5", label: "5 years" } ] },
      { key: "penalty", label: "Service-level penalty cap", options: [ { key: "p5", label: "5% of monthly fees" }, { key: "p10", label: "10% of monthly fees" }, { key: "p20", label: "20% of monthly fees" } ] },
      { key: "offshore", label: "Share of work offshore", options: [ { key: "o30", label: "30%" }, { key: "o60", label: "60%" }, { key: "o80", label: "80%" } ] },
    ],
    student_payoffs: {
      rate: { r2400: 4, r2800: 18, r3200: 30 },
      term: { y1: 2, y3: 14, y5: 22 },
      penalty: { p5: 16, p10: 10, p20: 2 },
      offshore: { o30: 2, o60: 12, o80: 20 },
    },
    counterparty_payoffs: {
      rate: { r2400: 30, r2800: 18, r3200: 4 },
      term: { y1: 12, y3: 16, y5: 8 },
      penalty: { p5: 2, p10: 14, p20: 20 },
      offshore: { o30: 14, o60: 12, o80: 6 },
    },
    student_batna: 38,
    counterparty_batna: 40,
  },
  {
    slug: "spice-brand-acquisition",
    title: "Buying a family-owned spice brand",
    difficulty: "hard",
    shared_brief:
      "A large FMCG company wants to acquire a well-known regional spice brand built by its founder over 30 years. Diligence is done and both sides want a deal. Five things are open: the price, how much is paid upfront versus on future performance, the founder's role after the deal, what happens to the brand name, and whether factory staff get a job guarantee.",
    student_role: "Head of corporate development at the FMCG company (the buyer)",
    counterparty_role: "Founder and managing director of the spice brand",
    student_brief:
      "Your board approved a price range, and every crore saved is noticed. You would like a meaningful part of the price paid as an earn-out, so the founder shares the risk if sales slip after the deal. Your team does not know the farmers and traders the founder buys from, so keeping the founder involved for a few years is worth a lot to you. You would prefer to fold the brand into your own over time, but it is not essential. A job guarantee constrains your plans for the factory, so you would rather not give one.",
    counterparty_brief:
      "You are the founder. You want a good price, and you want most of it in cash at closing — you have seen earn-outs disappear in arguments over accounts.\n\nBut money is not all of it. The brand carries your family's name and you would find it very hard to see it renamed or absorbed; keeping it as a standalone brand matters greatly to you. You do not want to retire — you would love to stay on and run the brand. And you feel responsible for the 200 people in your factory; a job guarantee for them matters to you nearly as much as a few crores.\n\nYou are proud, warm and a careful negotiator. Talk about price first, as buyers expect. Do not volunteer that you want to stay on; if the buyer suggests it, act as though it is a concession you are making.",
    issues: [
      { key: "price", label: "Price", options: [ { key: "p180", label: "₹180 crore" }, { key: "p220", label: "₹220 crore" }, { key: "p260", label: "₹260 crore" } ] },
      { key: "structure", label: "Payment structure", options: [ { key: "cash", label: "All cash at closing" }, { key: "e20", label: "80% at closing, 20% on 3-year performance" }, { key: "e40", label: "60% at closing, 40% on 3-year performance" } ] },
      { key: "role", label: "Founder's role", options: [ { key: "exit", label: "Leaves at closing" }, { key: "advisor", label: "Adviser for one year" }, { key: "head", label: "Runs the brand for three years" } ] },
      { key: "brand", label: "Brand name", options: [ { key: "renamed", label: "Folded into the buyer's brand in two years" }, { key: "sub", label: "Kept as a sub-brand" }, { key: "standalone", label: "Kept as a standalone brand" } ] },
      { key: "jobs", label: "Factory staff", options: [ { key: "none", label: "No guarantee" }, { key: "guarantee", label: "Two-year job guarantee" } ] },
    ],
    student_payoffs: {
      price: { p180: 34, p220: 20, p260: 4 },
      structure: { cash: 4, e20: 12, e40: 20 },
      role: { exit: 4, advisor: 10, head: 16 },
      brand: { renamed: 12, sub: 10, standalone: 6 },
      jobs: { none: 10, guarantee: 4 },
    },
    counterparty_payoffs: {
      price: { p180: 4, p220: 18, p260: 30 },
      structure: { cash: 20, e20: 12, e40: 2 },
      role: { exit: 4, advisor: 8, head: 18 },
      brand: { renamed: 0, sub: 10, standalone: 20 },
      jobs: { none: 2, guarantee: 16 },
    },
    student_batna: 44,
    counterparty_batna: 46,
  },
  {
    slug: "plant-wage-settlement",
    title: "Settling a wage agreement with the union",
    difficulty: "hard",
    shared_brief:
      "An auto components plant near Chennai is negotiating its three-year wage settlement with the workers' union. Relations are tense after a slowdown last month. Four things are open: the annual wage increase, a productivity-linked bonus, a new night shift, and a job security commitment.",
    student_role: "Head of HR at the plant (management)",
    counterparty_role: "President of the workers' union",
    student_brief:
      "Wages are the largest cost you control, so the annual increase matters most. You have just won a large export order that needs a third, night shift — without it you would have to turn the order away or outsource it, so the night shift is very valuable to you. You would like any extra pay to be linked to output. You have no plans to cut jobs — the plant is growing — so a job security commitment costs you little, though your directors dislike making promises.",
    counterparty_brief:
      "You lead the union. Your members' biggest fear is automation: the company has installed robots at its other plant and people believe jobs here are next. A written job security commitment is what you most need to bring back.\n\nYou want the highest wage increase you can get. Your members dislike night shifts, but with a fair allowance many would accept one. A productivity bonus is viewed with suspicion — workers suspect targets will be set to be missed — so you mildly prefer a plain increase.\n\nYou are tough and speak for 900 workers. Open with a high wage demand. Do not reveal that job security is the priority until management has made an offer on wages.",
    issues: [
      { key: "wage", label: "Annual wage increase", options: [ { key: "w7", label: "7%" }, { key: "w10", label: "10%" }, { key: "w13", label: "13%" } ] },
      { key: "bonus", label: "Productivity bonus", options: [ { key: "none", label: "No bonus" }, { key: "linked", label: "Bonus for output above target" } ] },
      { key: "shift", label: "Night shift", options: [ { key: "none", label: "No night shift" }, { key: "allowance", label: "Night shift with a 15% allowance" } ] },
      { key: "security", label: "Job security", options: [ { key: "none", label: "No commitment" }, { key: "y3", label: "No layoffs for three years" } ] },
    ],
    student_payoffs: {
      wage: { w7: 30, w10: 18, w13: 4 },
      bonus: { none: 4, linked: 16 },
      shift: { none: 2, allowance: 22 },
      security: { none: 10, y3: 7 },
    },
    counterparty_payoffs: {
      wage: { w7: 4, w10: 18, w13: 30 },
      bonus: { none: 12, linked: 8 },
      shift: { none: 14, allowance: 6 },
      security: { none: 2, y3: 26 },
    },
    student_batna: 40,
    counterparty_batna: 40,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const problems: string[] = [];
  for (const c of CASES) {
    const setup: NegotiationSetup = {
      issues: c.issues,
      studentPayoffs: c.student_payoffs,
      counterpartyPayoffs: c.counterparty_payoffs,
      studentBatna: c.student_batna,
      counterpartyBatna: c.counterparty_batna,
    };

    // Every option needs a score on both sides, or one side is silently
    // indifferent to a choice the other is arguing about.
    for (const issue of c.issues) {
      for (const option of issue.options) {
        if (c.student_payoffs[issue.key]?.[option.key] === undefined) {
          problems.push(`${c.slug}: student has no payoff for ${issue.key}/${option.key}`);
        }
        if (c.counterparty_payoffs[issue.key]?.[option.key] === undefined) {
          problems.push(`${c.slug}: counterparty has no payoff for ${issue.key}/${option.key}`);
        }
      }
    }

    /**
     * There must be a deal both sides prefer to walking away, or the exercise
     * is unwinnable and the student will conclude they negotiated badly when
     * the case was impossible.
     */
    const max = maxJointValue(setup);
    if (max < c.student_batna + c.counterparty_batna) {
      problems.push(
        `${c.slug}: no zone of agreement — best joint value ${max} is below the two walk-aways (${c.student_batna} + ${c.counterparty_batna})`,
      );
    }

    /**
     * And the issues must be ranked differently, or there is nothing to trade.
     * Checked by seeing whether any issue has a different best option for each
     * side.
     */
    const tradeable = c.issues.some((issue) => {
      const bestFor = (t: Record<string, Record<string, number>>) =>
        issue.options.reduce((best, o) =>
          (t[issue.key]?.[o.key] ?? 0) > (t[issue.key]?.[best.key] ?? 0) ? o : best,
        ).key;
      return bestFor(c.student_payoffs) !== bestFor(c.counterparty_payoffs);
    });
    if (!tradeable) {
      problems.push(`${c.slug}: both sides want the same option on every issue — nothing to trade`);
    }
  }

  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const c of CASES) {
    const { error } = await admin.from("negotiation_cases").upsert(c, { onConflict: "slug" });
    if (error) {
      console.error(`${c.slug}: ${error.message}`);
      process.exit(1);
    }
    const setup: NegotiationSetup = {
      issues: c.issues,
      studentPayoffs: c.student_payoffs,
      counterpartyPayoffs: c.counterparty_payoffs,
      studentBatna: c.student_batna,
      counterpartyBatna: c.counterparty_batna,
    };
    console.log(
      `  ✓ ${c.slug.padEnd(30)} max joint ${maxJointValue(setup)} vs walk-aways ${c.student_batna}+${c.counterparty_batna}`,
    );
  }
  console.log(`\nSeeded ${CASES.length} negotiations.`);
}

if (process.argv[1]?.endsWith("seed-negotiations.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
