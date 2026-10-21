import { describe, expect, it, vi } from "vitest";
import { MAX_EXTRACTED_BULLETS, pickBullets } from "@/lib/resume-bullets";

vi.mock("server-only", () => ({}));

/**
 * Real shapes of résumé text, taken from a sample CV read two ways: a PDF
 * (markers lost, long bullets wrapped) and a Word file (markers kept, headings
 * and job titles in between).
 */
const PDF_TEXT =
  "Aarav Sharma\naarav.sharma@example.com | +91 98765 43210 | linkedin.com/in/aarav\nEducation\nMBA, IIM Indore, 2024–2026 CGPA 3.4/4\nExperience\nSummer Intern, Marico Ltd — Mumbai, Apr–Jun 2025\nBuilt a pricing model for 3 hair-oil SKUs across 120 general-trade outlets in Pune, recommending a 6%\nprice increase that was rolled out to the West zone in August\nAnalysed 18 months of secondary sales data to find the 22 distributors driving 70% of stock-outs\nPresented the go-to-market plan to the regional sales head\nAnalyst, Deloitte — 2021–2024\nResponsible for managing the weekly client status report\nAutomated reconciliation in Excel, cutting month-end close by 2 days\nPositions of responsibility\nLed a 14-member team to run the college fest with a budget of ₹8 lakh";

const DOCX_TEXT =
  "Aarav Sharma\n\naarav.sharma@example.com | +91 98765 43210\n\nExperience\n\nSummer Intern, Marico Ltd — Mumbai, Apr–Jun 2025\n\n\t•\tBuilt a pricing model for 3 hair-oil SKUs\n\n\t•\tAnalysed 18 months of secondary sales data\n\nAnalyst, Deloitte — 2021–2024\n\n\t•\tAutomated reconciliation in Excel, cutting month-end close by 2 days\n\n";

describe("pickBullets", () => {
  it("finds the achievements in a PDF that lost its markers, and rejoins a wrapped bullet", () => {
    const bullets = pickBullets(PDF_TEXT);
    expect(bullets).toEqual([
      "Built a pricing model for 3 hair-oil SKUs across 120 general-trade outlets in Pune, recommending a 6% price increase that was rolled out to the West zone in August",
      "Analysed 18 months of secondary sales data to find the 22 distributors driving 70% of stock-outs",
      "Presented the go-to-market plan to the regional sales head",
      "Responsible for managing the weekly client status report",
      "Automated reconciliation in Excel, cutting month-end close by 2 days",
      "Led a 14-member team to run the college fest with a budget of ₹8 lakh",
    ]);
  });

  it("leaves out names, contact details, headings, and role or education lines with dates", () => {
    const joined = pickBullets(PDF_TEXT).join("\n");
    expect(joined).not.toMatch(/Aarav Sharma|@|Education|Marico Ltd|Deloitte|IIM Indore|Positions of responsibility/);
  });

  it("uses the bullet markers when a Word file has them", () => {
    expect(pickBullets(DOCX_TEXT)).toEqual([
      "Built a pricing model for 3 hair-oil SKUs",
      "Analysed 18 months of secondary sales data",
      "Automated reconciliation in Excel, cutting month-end close by 2 days",
    ]);
  });

  it("leaves out a skills section, even when it uses bullet markers", () => {
    const text = [
      "Skills",
      "• Prompt Engineering",
      "• Workflow Automation",
      "• NLP Pipelines",
      "Product Engineering •",
      "Python, SQL, Tableau, Power BI, Excel",
      "Prompt Engineering • Workflow Automation • GARCH Modeling",
      "Experience",
      "Analyst, Quantile Capital — Jan 2024 – Present",
      "Built a GARCH volatility model for 40 equities that cut forecast error by 18%",
      "Automated the weekly risk report in Python, saving the desk six hours a week",
    ].join("\n");
    expect(pickBullets(text)).toEqual([
      "Built a GARCH volatility model for 40 equities that cut forecast error by 18%",
      "Automated the weekly risk report in Python, saving the desk six hours a week",
    ]);
  });

  it("does not eat the number at the start of a bullet", () => {
    expect(pickBullets("• 40% growth in weekly active users over two quarters\n• Cut costs by 12 lakh in six months")[0]).toBe(
      "40% growth in weekly active users over two quarters",
    );
  });

  it("returns nothing for a file with no readable text", () => {
    expect(pickBullets("")).toEqual([]);
    expect(pickBullets("   \n\n  ")).toEqual([]);
  });

  it("caps what it hands back", () => {
    const many = Array.from({ length: 50 }, (_, i) => `• Delivered project number ${i + 1} on time and within budget`).join("\n");
    expect(pickBullets(many)).toHaveLength(MAX_EXTRACTED_BULLETS);
  });
});

describe("combinedSummary", () => {
  it("counts verdicts and the most common problems across every group", async () => {
    const { combinedSummary } = await import("@/lib/ai/resume-critique");
    const b = (verdict: "strong" | "needs_work" | "weak", issues: string[]) =>
      ({ original: "x", verdict, issues, feedback: "", rewrite: "", invented_numbers: [] }) as never;
    const summary = combinedSummary([
      b("strong", []),
      b("needs_work", ["no_number", "weak_verb"]),
      b("needs_work", ["no_number"]),
      b("weak", ["no_number", "vague"]),
    ]);
    expect(summary).toMatch(/^Of 4 bullets, 1 are strong, 2 need work and 1 are weak\./);
    expect(summary).toMatch(/no measurable result \(3\)/);
  });
});
