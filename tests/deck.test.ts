import { describe, expect, it } from "vitest";
import { countPagesIfVisible, groundSuggestedTitle, isPdf } from "@/lib/deck";

const encode = (s: string) => new TextEncoder().encode(s);

describe("isPdf", () => {
  it("checks the signature, not the name", () => {
    expect(isPdf(encode("%PDF-1.7\n..."))).toBe(true);
    expect(isPdf(encode("PK a pptx is a zip"))).toBe(false);
    expect(isPdf(encode("<html>deck.pdf</html>"))).toBe(false);
  });
});

describe("countPagesIfVisible", () => {
  it("counts page dictionaries and ignores the /Pages tree node", () => {
    const pdf = "%PDF-1.4\n1 0 obj <</Type /Pages /Count 3>>\n2 0 obj <</Type /Page>>\n3 0 obj <</Type/Page /Parent 1 0 R>>\n4 0 obj <</Type /Page>>";
    expect(countPagesIfVisible(encode(pdf))).toBe(3);
  });

  it("returns null when the page objects are compressed out of sight", () => {
    expect(countPagesIfVisible(encode("%PDF-1.7\n1 0 obj <</Type /ObjStm /Filter /FlateDecode>>"))).toBeNull();
  });
});

describe("groundSuggestedTitle", () => {
  it("keeps figures that are on the slide", () => {
    const { title, invented } = groundSuggestedTitle(
      "Margins fell from 22% to 18% as input costs rose 18%",
      "Margin analysis",
      ["EBITDA margin 22% → 18%", "Input costs +18%"],
    );
    expect(title).toBe("Margins fell from 22% to 18% as input costs rose 18%");
    expect(invented).toEqual([]);
  });

  it("blanks a derived figure too, since nothing on the slide shows it", () => {
    // 22 − 18 = 4 is arithmetic the student can check and write in; the guard
    // does not trust the model to have done it.
    const { title, invented } = groundSuggestedTitle(
      "Margins fell 4 points as input costs rose 18%",
      "Margin analysis",
      ["EBITDA margin 22% → 18%", "Input costs +18%"],
    );
    expect(title).toBe("Margins fell [X] points as input costs rose 18%");
    expect(invented).toEqual(["4"]);
  });

  it("replaces a figure the slide never showed", () => {
    const { title, invented } = groundSuggestedTitle(
      "Entering Tier-2 cities adds ₹450 crore of revenue by FY28",
      "Market entry",
      ["Tier-2 cities", "FY28"],
    );
    // "2" is on the slide (Tier-2); "450" is not.
    expect(title).toBe("Entering Tier-2 cities adds ₹[X] crore of revenue by FY28");
    expect(invented).toEqual(["450"]);
  });
});
