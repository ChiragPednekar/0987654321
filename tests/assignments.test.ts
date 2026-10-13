import { describe, expect, it } from "vitest";
import { assignmentTarget } from "@/lib/assignments";

describe("assignmentTarget", () => {
  it("treats a row with no kind as a case (rows from before 067)", () => {
    const t = assignmentTarget({ id: "a1", cases: { slug: "capital-raise-1", title: "Vantage" } });
    expect(t).toMatchObject({ kind: "case", href: "/cases/capital-raise-1", itemTitle: "Vantage" });
  });

  it("reads an embed returned as an array or as an object", () => {
    const asArray = assignmentTarget({ id: "a1", kind: "sql", sql_exercises: [{ slug: "joins-1", title: "Joins" }] });
    const asObject = assignmentTarget({ id: "a1", kind: "sql", sql_exercises: { slug: "joins-1", title: "Joins" } });
    expect(asArray.href).toBe("/sql/joins-1");
    expect(asObject.href).toBe("/sql/joins-1");
  });

  it("links an Excel exercise and an aptitude quiz to their own pages", () => {
    expect(assignmentTarget({ id: "a2", kind: "excel", excel_exercises: { slug: "vlookup", title: "VLOOKUP" } }).href).toBe("/excel/vlookup");
    const quiz = assignmentTarget({ id: "a3", kind: "aptitude", question_ids: ["q1", "q2", "q3"] });
    expect(quiz).toMatchObject({ href: "/practice/assigned/a3", itemTitle: "3 questions", kindLabel: "Aptitude quiz" });
  });

  it("has no link when the assigned item no longer exists", () => {
    expect(assignmentTarget({ id: "a4", kind: "case", cases: null }).href).toBeNull();
    expect(assignmentTarget({ id: "a5", kind: "sql", sql_exercises: [] }).href).toBeNull();
  });
});
