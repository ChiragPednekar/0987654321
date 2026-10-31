import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cameraReady } from "@/lib/proctor-readiness";
import { CaseProctorShell } from "@/components/case/case-proctor-shell";
import { ProctorGate } from "@/components/case/proctor-overlay";
import type { CameraApi } from "@/hooks/use-camera-proctor";

vi.stubGlobal("React", React);
vi.mock("@/hooks/use-proctor", () => ({
  useProctor: () => ({
    examMode: false, starting: false,
    camera: { status: "idle", detector: "idle", signals: {} },
  }),
}));

describe("case proctoring entry", () => {
  it.each([false, true])("requires camera access for a student, including retries (submitted=%s)", (hasSubmitted) => {
    const html = renderToStaticMarkup(React.createElement(
      CaseProctorShell,
      {
        caseId: "case", slug: "case", signedIn: true, entitled: true,
        defaultTab: "problem", hasSubmissionParam: false, hasSubmitted,
        // children arrive as the third argument (react/no-children-prop).
      } as React.ComponentProps<typeof CaseProctorShell>,
      "Private case content",
    ));
    expect(html).toContain("Turn on camera");
    expect(html).not.toContain("Private case content");
  });

  it.each(["idle", "loading", "failed"])("does not treat a live camera with %s detectors as ready", (detector) => {
    expect(cameraReady({ status: "on", detector })).toBe(false);
  });

  it("only allows start with the camera and detectors ready", () => {
    expect(cameraReady({ status: "on", detector: "ready" })).toBe(true);
    expect(cameraReady({ status: "denied", detector: "ready" })).toBe(false);
  });

  it.each([
    ["loading", "Loading camera checks…"],
    ["failed", "Try the camera again"],
  ])("shows an actionable %s state instead of Start", (detector, label) => {
    const camera = { status: "on", detector, signals: {} } as CameraApi;
    const html = renderToStaticMarkup(React.createElement(ProctorGate, {
      camera, starting: false, onStart: vi.fn(),
    }));
    expect(html).toContain(label);
    expect(html).not.toMatch(/>Start</);
  });
});
