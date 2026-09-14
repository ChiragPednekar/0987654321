import { describe, expect, it } from "vitest";
import { numbersIn, parseBullets, stripInventedNumbers } from "@/lib/resume";

describe("parseBullets", () => {
  it("strips the list markers people paste in", () => {
    const text = [
      "• Led a team of 6 to launch the app",
      "- Built the pricing model",
      "  * Ran 12 customer interviews  ",
      "1. Cut churn",
      "2) Wrote the SOP",
      "",
      "   ",
      "– Owned the vendor relationship",
    ].join("\n");
    expect(parseBullets(text)).toEqual([
      "Led a team of 6 to launch the app",
      "Built the pricing model",
      "Ran 12 customer interviews",
      "Cut churn",
      "Wrote the SOP",
      "Owned the vendor relationship",
    ]);
  });

  it("does not eat a number that starts the bullet", () => {
    // "12 stores" is content, not a list marker.
    expect(parseBullets("12 stores onboarded in a quarter")).toEqual([
      "12 stores onboarded in a quarter",
    ]);
    expect(parseBullets("4.5x growth in repeat orders")).toEqual([
      "4.5x growth in repeat orders",
    ]);
  });
});

describe("numbersIn", () => {
  it("treats Indian and Western grouping as the same number", () => {
    expect(numbersIn("₹1,20,000 and 120,000 and 120000")).toEqual([
      "120000",
      "120000",
      "120000",
    ]);
  });

  it("keeps decimals and drops a trailing .0", () => {
    expect(numbersIn("grew 4.5x, then 3.0x")).toEqual(["4.5", "3"]);
  });
});

describe("stripInventedNumbers", () => {
  it("replaces a result the student never measured with a placeholder", () => {
    const { rewrite, invented } = stripInventedNumbers(
      "Improved the onboarding flow for new sellers",
      "Redesigned seller onboarding, cutting time-to-first-listing by 40% across 1,200 sellers",
    );
    expect(rewrite).toBe(
      "Redesigned seller onboarding, cutting time-to-first-listing by [X]% across [X] sellers",
    );
    expect(invented).toEqual(["40", "1,200"]);
  });

  it("keeps the student's own numbers, however they are formatted", () => {
    const { rewrite, invented } = stripInventedNumbers(
      "Managed a budget of Rs 1,20,000 for a team of 6",
      "Managed a ₹120,000 budget across a 6-person team",
    );
    expect(rewrite).toBe("Managed a ₹120,000 budget across a 6-person team");
    expect(invented).toEqual([]);
  });

  it("catches an invented number even when a real one sits beside it", () => {
    // 6 is theirs; 25% is not.
    const { rewrite, invented } = stripInventedNumbers(
      "Led a team of 6 on the pricing revamp",
      "Led 6 analysts on a pricing revamp that lifted margin 25%",
    );
    expect(rewrite).toBe("Led 6 analysts on a pricing revamp that lifted margin [X]%");
    expect(invented).toEqual(["25"]);
  });

  it("leaves an existing placeholder alone", () => {
    const { rewrite, invented } = stripInventedNumbers(
      "Cut churn",
      "Cut monthly churn by [X]% by rebuilding the win-back emails",
    );
    expect(rewrite).toBe("Cut monthly churn by [X]% by rebuilding the win-back emails");
    expect(invented).toEqual([]);
  });
});
