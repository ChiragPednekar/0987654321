import { describe, expect, it } from "vitest";
import { open, seal } from "../scripts/lib/backup-format";

const DATA = { tables: { users: [{ email: "student@example.com" }] } };
const PASS = "correct horse battery staple";

describe("sealed backup format", () => {
  it("round-trips", () => {
    expect(open(seal(DATA, PASS), PASS)).toEqual(DATA);
  });

  it("contains no plaintext", () => {
    // The whole point: a public artifact must not leak an email.
    expect(seal(DATA, PASS).includes(Buffer.from("student@example.com"))).toBe(false);
  });

  it("refuses the wrong passphrase", () => {
    expect(() => open(seal(DATA, PASS), PASS + "x")).toThrow(/wrong passphrase/);
  });

  it("refuses a damaged file instead of restoring garbage", () => {
    const file = seal(DATA, PASS);
    file[file.length - 1] ^= 0xff;
    expect(() => open(file, PASS)).toThrow(/damaged/);
  });

  it("never seals the same data the same way twice", () => {
    expect(seal(DATA, PASS).equals(seal(DATA, PASS))).toBe(false);
  });
});
