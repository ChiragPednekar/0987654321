import { describe, expect, it } from "vitest";
import { checkExcelExercise, checkSqlExercise, parsePastedGrid } from "@/lib/teacher-exercises";
import { inspectSetup } from "@/lib/sql/runner";
import { STORE_HIDDEN_SETUP, STORE_SETUP } from "@/lib/sql/datasets";
import { SALES, SALES_HIDDEN } from "@/lib/excel/datasets";

const store = (solution: string, orderMatters = false) =>
  checkSqlExercise({ setup: STORE_SETUP, hidden: STORE_HIDDEN_SETUP, solution, orderMatters, customData: false });

describe("checkSqlExercise", () => {
  it("accepts an answer that differs between the datasets and returns the visible rows", async () => {
    const check = await store(
      "select c.city, count(*) from orders o join customers c on c.id = o.customer_id group by c.city",
    );
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.value.visible.rows.length).toBeGreaterThan(0);
  });

  it("refuses an answer that fails", async () => {
    const check = await store("select nope from orders");
    expect(check).toMatchObject({ ok: false });
    if (!check.ok) expect(check.error).toMatch(/fails on the visible data/);
  });

  it("refuses an answer that returns nothing", async () => {
    const check = await store("select * from orders where status = 'no such status'");
    if (check.ok) throw new Error("expected a refusal");
    expect(check.error).toMatch(/no rows/);
  });

  it("refuses an answer that is the same on both datasets", async () => {
    // The schema is identical, so its column list is too: typeable by hand.
    const check = await store("select count(*) from (select 1)");
    if (check.ok) throw new Error("expected a refusal");
    expect(check.error).toMatch(/same result on both/);
  });

  it("refuses a second dataset with different tables", async () => {
    const check = await checkSqlExercise({
      setup: "create table t (a integer); insert into t values (1), (2);",
      hidden: "create table u (a integer); insert into u values (3);",
      solution: "select sum(a) from t",
      orderMatters: false,
      customData: true,
    });
    if (check.ok) throw new Error("expected a refusal");
    expect(check.error).toMatch(/same tables and columns/);
  });

  it("accepts the teacher's own data when the answer tells it apart", async () => {
    const check = await checkSqlExercise({
      setup: "create table t (a integer); insert into t values (1), (2);",
      hidden: "create table t (a integer); insert into t values (5), (7), (9);",
      solution: "select sum(a) from t",
      orderMatters: false,
      customData: true,
    });
    expect(check).toMatchObject({ ok: true });
  });
});

describe("inspectSetup", () => {
  it("refuses a dataset that generates rows with a query", async () => {
    const r = await inspectSetup(
      "create table t (a integer); with recursive n(i) as (select 1 union all select i + 1 from n) insert into t select i from n limit 1000000;",
    );
    expect(r.ok).toBe(false);
  });

  it("ignores keywords inside string values", async () => {
    const r = await inspectSetup("create table p (name text); insert into p values ('Select pack'), ('Drop-in');");
    expect(r).toMatchObject({ ok: true, tables: [{ name: "p", columns: ["name"], rows: 2 }] });
  });
});

describe("checkExcelExercise", () => {
  it("accepts a formula that differs between the sheets", () => {
    const check = checkExcelExercise({ grid: SALES, hidden: SALES_HIDDEN, solution: '=SUMIFS(E:E,B:B,"West")', tolerance: 1e-6 });
    expect(check).toMatchObject({ ok: true });
  });

  it("refuses a typed-in constant", () => {
    const check = checkExcelExercise({ grid: SALES, hidden: SALES_HIDDEN, solution: "=42", tolerance: 1e-6 });
    if (check.ok) throw new Error("expected a refusal");
    expect(check.error).toMatch(/same on both sheets/);
  });

  it("refuses sheets with different headers", () => {
    const check = checkExcelExercise({
      grid: [["A", "B"], [1, 2]],
      hidden: [["A", "C"], [3, 4]],
      solution: "=SUM(A:A)",
      tolerance: 1e-6,
    });
    if (check.ok) throw new Error("expected a refusal");
    expect(check.error).toMatch(/same header row/);
  });
});

describe("parsePastedGrid", () => {
  it("reads cells copied from Excel", () => {
    expect(parsePastedGrid("Region\tUnits\tActive\r\nWest\t1,200\tTRUE\r\nEast\t\tfalse\r\n\r\n")).toEqual([
      ["Region", "Units", "Active"],
      ["West", 1200, true],
      ["East", null, false],
    ]);
  });

  it("falls back to commas for a CSV", () => {
    expect(parsePastedGrid("a,b\n1.5,x")).toEqual([["a", "b"], [1.5, "x"]]);
  });
});
