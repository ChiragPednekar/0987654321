import { describe, expect, it } from "vitest";
import { compareResults, guardQuery, type ResultSet } from "@/lib/sql/runner";

describe("guardQuery", () => {
  it("allows an ordinary SELECT and a CTE", () => {
    expect(guardQuery("select city, count(*) from orders group by city").ok).toBe(true);
    expect(guardQuery("with t as (select 1 as n) select n from t").ok).toBe(true);
    expect(guardQuery("  SELECT 1;  ").ok).toBe(true);
  });

  it("refuses anything that writes", () => {
    for (const sql of [
      "insert into orders values (1)",
      "update orders set city = 'x'",
      "delete from orders",
      "drop table orders",
      "create table t (a int)",
      "alter table orders add column x int",
    ]) {
      expect(guardQuery(sql).ok, sql).toBe(false);
    }
  });

  it("refuses statements that reach outside the fixture", () => {
    for (const sql of [
      "attach database '/etc/passwd' as p",
      "pragma table_info(orders)",
      "select load_extension('x')",
      "select readfile('/etc/passwd')",
    ]) {
      expect(guardQuery(sql).ok, sql).toBe(false);
    }
  });

  it("refuses a second statement smuggled after a semicolon", () => {
    const r = guardQuery("select 1; drop table orders");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/single/i);
  });

  it("sees a statement hidden behind a comment", () => {
    // The reason comments are stripped before the scan: a line comment can
    // hide the separator that turns one statement into two.
    expect(guardQuery("select 1 -- \n ; attach database 'x' as y").ok).toBe(false);
  });

  it("does not refuse a forbidden word that is only inside a comment", () => {
    // Stripping comments cuts both ways, and this direction is correct:
    // SQLite ignores the comment too, so there is nothing to refuse. Flagging
    // it would be the same false positive as refusing a created_at column.
    expect(guardQuery("select /* attach */ 1").ok).toBe(true);
    expect(guardQuery("select 1 -- we could drop this later").ok).toBe(true);
  });

  it("does not refuse a column that merely contains a forbidden word", () => {
    // created_at contains "create". Refusing it would break most real
    // exercises, which is the kind of false positive a substring scan makes.
    expect(guardQuery("select created_at from orders").ok).toBe(true);
    expect(guardQuery("select updated_at, deleted_flag from orders").ok).toBe(true);
  });

  it("insists the statement starts with SELECT or WITH", () => {
    expect(guardQuery("explain select 1").ok).toBe(false);
    expect(guardQuery("").ok).toBe(false);
  });
});

const EXPECTED: ResultSet = {
  columns: ["city", "n"],
  rows: [
    ["Mumbai", 3],
    ["Pune", 2],
    ["Delhi", 2],
  ],
};

describe("compareResults", () => {
  it("accepts the same rows in a different order when order does not matter", () => {
    const actual: ResultSet = {
      columns: ["c", "count"],
      rows: [
        ["Delhi", 2],
        ["Mumbai", 3],
        ["Pune", 2],
      ],
    };
    expect(compareResults(EXPECTED, actual, false).correct).toBe(true);
  });

  it("rejects that same reordering when the exercise asked for an order", () => {
    const actual: ResultSet = {
      columns: ["c", "count"],
      rows: [
        ["Delhi", 2],
        ["Mumbai", 3],
        ["Pune", 2],
      ],
    };
    const r = compareResults(EXPECTED, actual, true);
    expect(r.correct).toBe(false);
    expect(r.reason).toMatch(/ORDER BY/);
  });

  it("ignores column names but not column count", () => {
    // Failing a student for writing `as total` instead of `as n` would be the
    // most infuriating thing this grader could do.
    const renamed: ResultSet = { columns: ["place", "total"], rows: EXPECTED.rows };
    expect(compareResults(EXPECTED, renamed, false).correct).toBe(true);

    const extra: ResultSet = {
      columns: ["c", "n", "x"],
      rows: EXPECTED.rows.map((r) => [...r, 1]),
    };
    expect(compareResults(EXPECTED, extra, false).correct).toBe(false);
  });

  it("counts duplicates, so a missing GROUP BY cannot pass", () => {
    const duped: ResultSet = {
      columns: ["c", "n"],
      rows: [
        ["Mumbai", 3],
        ["Mumbai", 3],
        ["Pune", 2],
      ],
    };
    expect(compareResults(EXPECTED, duped, false).correct).toBe(false);
  });

  it("treats floating-point noise as the same number", () => {
    const exp: ResultSet = { columns: ["avg"], rows: [[33.333333333333336]] };
    const act: ResultSet = { columns: ["avg"], rows: [[33.33333333333333]] };
    expect(compareResults(exp, act, false).correct).toBe(true);
  });

  it("does not confuse null with an empty string", () => {
    const exp: ResultSet = { columns: ["v"], rows: [[null]] };
    const act: ResultSet = { columns: ["v"], rows: [[""]] };
    expect(compareResults(exp, act, false).correct).toBe(false);
  });

  it("reports a row-count mismatch plainly", () => {
    const short: ResultSet = { columns: ["c", "n"], rows: [["Mumbai", 3]] };
    const r = compareResults(EXPECTED, short, false);
    expect(r.correct).toBe(false);
    expect(r.reason).toMatch(/3 row\(s\), got 1/);
  });
});
