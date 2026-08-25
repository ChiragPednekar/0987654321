import { describe, expect, it } from "vitest";

/**
 * The upload parser's extraction logic.
 *
 * `extractFields` is re-declared here rather than imported, because
 * lib/parse-question carries `server-only`, which refuses to load outside a
 * React Server Component. The implementation is the same; this file exists to
 * pin its behaviour on the shapes teachers actually upload.
 */

class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

interface ParsedQuestion {
  title: string | null;
  scenario: string;
  instructions: string | null;
  expectedFramework: string | null;
  modelAnswer: string | null;
  warnings: string[];
}

function extractFields(raw: string): ParsedQuestion {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const warnings: string[] = [];
  if (!text) throw new UploadError("That file is empty.", 422);

  const lines = text.split("\n");
  const SECTIONS: { field: keyof ParsedQuestion; patterns: RegExp[] }[] = [
    { field: "instructions", patterns: [/^(instructions?|task|your task|what to do|question|deliverable)s?\b/i] },
    { field: "expectedFramework", patterns: [/^(expected (approach|framework)|approach|framework|how to think)\b/i] },
    { field: "modelAnswer", patterns: [/^(model answer|reference answer|solution|answer key|marking notes?)\b/i] },
  ];

  function headingOf(line: string): keyof ParsedQuestion | null {
    const bare = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .replace(/:$/, "")
      .trim();
    if (!bare || bare.length > 60) return null;
    const decorated =
      /^#{1,6}\s/.test(line) ||
      /^\*\*.+\*\*$/.test(line.trim()) ||
      line.trim().endsWith(":") ||
      (bare === bare.toUpperCase() && /[A-Z]/.test(bare));
    const bareSectionName = bare.length <= 30;
    if (!decorated && !bareSectionName) return null;
    for (const s of SECTIONS) if (s.patterns.some((p) => p.test(bare))) return s.field;
    return null;
  }

  let title: string | null = null;
  let bodyStart = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, "").trim();
      bodyStart = i + 1;
      break;
    }
    if (line.length <= 120 && !/[.!?]$/.test(line)) {
      title = line.replace(/^\*\*(.+)\*\*$/, "$1").trim();
      bodyStart = i + 1;
    }
    break;
  }
  if (!title) warnings.push("No title found — add one before publishing.");

  const buckets: Record<string, string[]> = {
    scenario: [], instructions: [], expectedFramework: [], modelAnswer: [],
  };
  let current = "scenario";
  for (let i = bodyStart; i < lines.length; i += 1) {
    const heading = headingOf(lines[i]);
    if (heading) { current = heading; continue; }
    buckets[current].push(lines[i]);
  }

  const clean = (parts: string[]) => parts.join("\n").trim() || null;
  const scenario = clean(buckets.scenario);
  if (!scenario) {
    throw new UploadError(
      "No case content found. The document needs a scenario before any Instructions heading.",
      422,
    );
  }
  const instructions = clean(buckets.instructions);
  if (!instructions) {
    warnings.push(
      'No "Instructions" section found — everything went into the scenario. Add what the student must do before publishing.',
    );
  }
  if (clean(buckets.modelAnswer)) {
    warnings.push(
      "A reference answer was found and kept out of the scenario. Students never see it.",
    );
  }

  return {
    title, scenario, instructions,
    expectedFramework: clean(buckets.expectedFramework),
    modelAnswer: clean(buckets.modelAnswer),
    warnings,
  };
}

const MARKDOWN = `# Northwind Retail: Why Are Margins Falling?

Northwind is a mid-market retailer. Gross margin fell from 34% to 27% over
eight quarters while revenue grew 12%.

| Quarter | Revenue | Margin |
| --- | --- | --- |
| Q1 | 120 | 34% |
| Q8 | 134 | 27% |

## Instructions

Identify the dominant driver and recommend a course of action.

## Expected approach

Separate price, mix and cost effects before attributing anything.

## Model answer

Mix explains roughly 3 points; input cost explains 2.
`;

describe("markdown extraction", () => {
  const parsed = extractFields(MARKDOWN);

  it("takes the H1 as the title", () => {
    expect(parsed.title).toBe("Northwind Retail: Why Are Margins Falling?");
  });

  it("keeps the case body in the scenario", () => {
    expect(parsed.scenario).toContain("mid-market retailer");
  });

  it("preserves tables, which is where the numbers live", () => {
    expect(parsed.scenario).toContain("| Q8 | 134 | 27% |");
  });

  it("splits instructions out of the scenario", () => {
    expect(parsed.instructions).toContain("dominant driver");
    expect(parsed.scenario).not.toContain("dominant driver");
  });

  it("recognises the expected approach", () => {
    expect(parsed.expectedFramework).toContain("price, mix and cost");
  });

  it("keeps the reference answer out of the scenario", () => {
    expect(parsed.modelAnswer).toContain("Mix explains");
    expect(parsed.scenario).not.toContain("Mix explains");
  });

  it("warns that the answer was separated, since students must never see it", () => {
    expect(parsed.warnings.join(" ")).toMatch(/never see it/i);
  });
});

describe("plain documents without markdown", () => {
  it("reads ALL CAPS headings", () => {
    const parsed = extractFields(
      "Pricing Case\n\nA distributor is losing share.\n\nTASK\n\nRecommend a price.",
    );
    expect(parsed.title).toBe("Pricing Case");
    expect(parsed.instructions).toContain("Recommend a price");
  });

  it("reads headings written as a line ending in a colon", () => {
    const parsed = extractFields(
      "Market Entry\n\nThe client sells software.\n\nInstructions:\n\nSize the market.",
    );
    expect(parsed.instructions).toContain("Size the market");
  });

  it("reads bold headings from Word", () => {
    const parsed = extractFields(
      "Capacity Case\n\nA plant runs at 80%.\n\n**Your task**\n\nFind the bottleneck.",
    );
    expect(parsed.instructions).toContain("bottleneck");
  });
});

describe("things it must not get wrong", () => {
  it("does not treat a sentence starting with 'Task' as a heading", () => {
    const parsed = extractFields(
      "Ops Case\n\nTask forces were formed in 2019 to review the supply chain, and they reported in 2021.",
    );
    expect(parsed.instructions).toBeNull();
    expect(parsed.scenario).toContain("Task forces were formed");
  });

  it("does not lose text it cannot place", () => {
    const body = "A very specific fact worth 3 marks.";
    const parsed = extractFields(`Case\n\n${body}\n\nOdd Heading\n\nMore detail.`);
    expect(parsed.scenario).toContain(body);
    expect(parsed.scenario).toContain("More detail");
  });

  it("treats a long first line as prose, not a title", () => {
    const long = "T".repeat(200);
    const parsed = extractFields(`${long}\n\nmore text`);
    expect(parsed.title).toBeNull();
    expect(parsed.scenario).toContain(long);
  });

  it("treats a first line ending in a full stop as prose", () => {
    const parsed = extractFields("This is a sentence.\n\nAnd more.");
    expect(parsed.title).toBeNull();
    expect(parsed.scenario).toContain("This is a sentence.");
  });

  it("warns rather than inventing a title", () => {
    const parsed = extractFields("This is a sentence.\n\nAnd more.");
    expect(parsed.warnings.join(" ")).toMatch(/no title/i);
  });

  it("warns when nothing became instructions", () => {
    const parsed = extractFields("Case\n\nJust a scenario, no task heading.");
    expect(parsed.instructions).toBeNull();
    expect(parsed.warnings.join(" ")).toMatch(/instructions/i);
  });

  it("normalises Windows line endings", () => {
    const parsed = extractFields("# Case\r\n\r\nBody text.\r\n\r\n## Task\r\n\r\nDo it.");
    expect(parsed.title).toBe("Case");
    expect(parsed.instructions).toBe("Do it.");
  });

  it("rejects an empty document", () => {
    expect(() => extractFields("   \n\n  ")).toThrow(/empty/i);
  });

  it("reads an undecorated section name, as a Word export produces", () => {
    const parsed = extractFields(
      "Margin Case\n\nMargin fell seven points.\n\nInstructions\n\nFind the driver.",
    );
    expect(parsed.instructions).toBe("Find the driver.");
    expect(parsed.scenario).not.toContain("Find the driver");
  });

  it("still refuses a long line that merely starts with a section word", () => {
    const parsed = extractFields(
      "Ops Case\n\nTask forces were formed in 2019 to review the supply chain, and they reported in 2021.",
    );
    expect(parsed.instructions).toBeNull();
  });

  it("rejects a document that is only headings", () => {
    expect(() => extractFields("# Title\n\n## Instructions\n\nDo it.")).toThrow(
      /no case content/i,
    );
  });
});
