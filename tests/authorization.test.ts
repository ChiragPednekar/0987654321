import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import crypto from "node:crypto";

config({ path: ".env.local" });

/**
 * Authorization, tested against the running application.
 *
 * These hit the deployed site rather than mocking the auth layer, because the
 * thing being tested IS the layer — a mock would only prove the mock agrees
 * with itself. Every account is created and deleted inside the run.
 *
 * Set TEST_BASE_URL to point at a preview or a local dev server.
 */

const BASE = process.env.TEST_BASE_URL ?? "https://mableetcode.vercel.app";
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const REF = SB.split("//")[1].split(".")[0];

const SVC = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "content-type": "application/json",
};

interface Account {
  id: string;
  email: string;
  cookie: string;
}

const created: string[] = [];
const classrooms: string[] = [];

async function makeAccount(tag: string, role?: string): Promise<Account> {
  const email = `qa-${tag}-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = `QaTest!${crypto.randomUUID().slice(0, 8)}Aa1`;

  const createRes = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: SVC,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await createRes.json();
  created.push(user.id);

  if (role) {
    await fetch(`${SB}/rest/v1/users?id=eq.${user.id}`, {
      method: "PATCH",
      headers: SVC,
      body: JSON.stringify({ role }),
    });
  }

  const tokenRes = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await tokenRes.json();
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");

  return { id: user.id, email, cookie: `sb-${REF}-auth-token=base64-${encoded}` };
}

async function api(
  method: string,
  path: string,
  account: Account | null,
  body?: unknown,
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(account ? { Cookie: account.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    // HTML pages and redirects have no JSON body; status is what matters.
  }
  return { status: res.status, body: parsed };
}

let student: Account;
let teacherA: Account;
let teacherB: Account;
let admin: Account;
let batchA: string;
let assignmentA: string;

beforeAll(async () => {
  [student, teacherA, teacherB, admin] = await Promise.all([
    makeAccount("student"),
    makeAccount("teacher-a", "teacher"),
    makeAccount("teacher-b", "teacher"),
    makeAccount("admin", "admin"),
  ]);

  const batch = await api("POST", "/api/classrooms", teacherA, {
    name: `QA Batch ${Date.now()}`,
  });
  batchA = batch.body.id as string;
  classrooms.push(batchA);

  // A platform case, so the assignment has something gradeable to point at.
  const caseRes = await fetch(
    `${SB}/rest/v1/cases?slug=eq.capital-raise-1&select=id`,
    { headers: SVC },
  );
  const [caseRow] = await caseRes.json();

  const assignment = await api("POST", "/api/teacher/assignments", teacherA, {
    classroom_id: batchA,
    case_id: caseRow.id,
    title: "QA assignment",
    max_marks: 20,
  });
  assignmentA = assignment.body.id as string;
}, 180_000);

afterAll(async () => {
  await Promise.all(
    classrooms.map((id) =>
      fetch(`${SB}/rest/v1/classrooms?id=eq.${id}`, { method: "DELETE", headers: SVC }),
    ),
  );
  await Promise.all(
    created.map((id) =>
      fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: SVC }),
    ),
  );
}, 180_000);

describe("setup", () => {
  it("creates the fixtures the rest of the suite depends on", () => {
    expect(batchA).toBeTruthy();
    expect(assignmentA).toBeTruthy();
  });
});

describe("students cannot reach teacher functions", () => {
  it("refuses to create an assignment", async () => {
    const res = await api("POST", "/api/teacher/assignments", student, {
      classroom_id: batchA,
      case_id: crypto.randomUUID(),
      title: "Hostile",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("refuses to write a question", async () => {
    const res = await api("POST", "/api/teacher/questions", student, {
      title: "Hostile question",
      classroom_id: batchA,
      domain: "finance",
      difficulty: "easy",
      format: "full_case",
      scenario: "x".repeat(60),
      instructions: "do the thing",
      rubric: [{ key: "a", label: "A", weight: 10 }],
    });
    expect(res.status).toBe(403);
  });

  it("refuses to mark an assignment", async () => {
    const res = await api(
      "POST",
      `/api/classrooms/assignments/${assignmentA}/review`,
      student,
      { student_id: student.id, marks: 20 },
    );
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});

describe("teachers are scoped to their own batches", () => {
  it("lets teacher A mark in their own batch", async () => {
    // Nobody has submitted, so a 404 on the student is the correct answer —
    // and it proves the authorization check passed to reach that point.
    const res = await api(
      "POST",
      `/api/classrooms/assignments/${assignmentA}/review`,
      teacherA,
      { student_id: student.id, marks: 10 },
    );
    expect(res.status).toBe(404);
    expect(String(res.body.error)).toMatch(/has not submitted/i);
  });

  it("stops teacher B marking teacher A's assignment", async () => {
    const res = await api(
      "POST",
      `/api/classrooms/assignments/${assignmentA}/review`,
      teacherB,
      { student_id: student.id, marks: 20 },
    );
    // 404 rather than 403 on purpose: confirming the assignment exists is
    // itself a small leak.
    expect(res.status).toBe(404);
  });

  it("stops teacher B assigning work into teacher A's batch", async () => {
    const res = await api("POST", "/api/teacher/assignments", teacherB, {
      classroom_id: batchA,
      case_id: crypto.randomUUID(),
      title: "Intrusion",
    });
    expect(res.status).toBe(404);
  });

  it("stops teacher B editing teacher A's assignment", async () => {
    const res = await api(
      "PATCH",
      `/api/teacher/assignments/${assignmentA}`,
      teacherB,
      { title: "Renamed by someone else" },
    );
    expect(res.status).toBe(404);
  });

  it("stops teacher B deleting teacher A's assignment", async () => {
    const res = await api(
      "DELETE",
      `/api/teacher/assignments/${assignmentA}`,
      teacherB,
    );
    expect(res.status).toBe(404);
  });
});

describe("teachers cannot reach platform-owner functions", () => {
  it("refuses to create a licence", async () => {
    const res = await api("POST", "/api/admin/institutions", teacherA, {
      name: "Hostile College",
      seats_licensed: 9_999,
      contract_value_inr: 1,
    });
    expect(res.status).toBe(403);
  });

  it("refuses to suspend a licence", async () => {
    const res = await api(
      "PATCH",
      `/api/admin/institutions/${crypto.randomUUID()}`,
      teacherA,
      { is_suspended: true },
    );
    expect(res.status).toBe(403);
  });

  it("refuses to edit the platform case library", async () => {
    const res = await api("POST", "/api/admin/cases", teacherA, {
      title: "Hostile case",
    });
    expect(res.status).toBe(403);
  });
});

describe("the platform owner can operate the platform", () => {
  it("creates and then removes a licence", async () => {
    const create = await api("POST", "/api/admin/institutions", admin, {
      name: `QA Institution ${Date.now()}`,
      seats_licensed: 10,
      contract_value_inr: 100_000,
    });
    expect(create.status).toBe(201);

    const id = create.body.id as string;
    const patch = await api("PATCH", `/api/admin/institutions/${id}`, admin, {
      is_suspended: true,
    });
    expect(patch.status).toBe(200);

    const remove = await api("DELETE", `/api/admin/institutions/${id}`, admin);
    expect(remove.status).toBe(200);
  });
});

describe("anonymous callers reach nothing", () => {
  it("cannot create an assignment", async () => {
    const res = await api("POST", "/api/teacher/assignments", null, {
      classroom_id: batchA,
      case_id: crypto.randomUUID(),
      title: "Anon",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("cannot create a licence", async () => {
    const res = await api("POST", "/api/admin/institutions", null, {
      name: "Anon College",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("cannot read usage events with the publishable key", async () => {
    const res = await fetch(`${SB}/rest/v1/usage_events?select=cost_inr`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const body = await res.text();
    expect(body).toMatch(/42501|permission denied/i);
  });

  it("cannot read the audit log with the publishable key", async () => {
    const res = await fetch(`${SB}/rest/v1/audit_log?select=action`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const body = await res.text();
    expect(body).toMatch(/42501|permission denied/i);
  });
});

describe("assignment validation", () => {
  it("rejects a due date before the start date", async () => {
    const res = await api("POST", "/api/teacher/assignments", teacherA, {
      classroom_id: batchA,
      case_id: crypto.randomUUID(),
      title: "Backwards",
      starts_at: "2026-12-01T00:00:00Z",
      due_at: "2026-11-01T00:00:00Z",
    });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/after the start date/i);
  });

  it("rejects a case that does not exist", async () => {
    const res = await api("POST", "/api/teacher/assignments", teacherA, {
      classroom_id: batchA,
      case_id: crypto.randomUUID(),
      title: "Ghost case",
    });
    expect(res.status).toBe(404);
  });

  it("rejects a mark above the assignment maximum", async () => {
    const res = await api(
      "POST",
      `/api/classrooms/assignments/${assignmentA}/review`,
      teacherA,
      { student_id: student.id, marks: 500 },
    );
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/cannot exceed/i);
  });
});
