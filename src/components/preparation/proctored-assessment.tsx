"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProctor } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "@/components/case/proctor-overlay";
import { CameraPreview } from "@/components/proctor/camera-preview";
import { fieldClass, mutate } from "@/components/placement/forms";

/**
 * A college common assessment, sat under the same conditions as a
 * certificate exam: fullscreen, camera on, paste refused, leaving ends it.
 *
 * These are the results a placement cell can put in front of a company, so
 * they are the ones that have to hold up. The question itself is fetched only
 * after Start, so it cannot be read in advance with the proctor off.
 */
export function ProctoredAssessment({ assessmentId, title }: { assessmentId: string; title: string }) {
  const proctor = useProctor(true);
  const router = useRouter();
  const [scenario, setScenario] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    // Fullscreen needs this click's gesture, so the proctor starts before the network wait.
    const armed = proctor.start();
    setOpening(true);
    try {
      const data = await mutate("/api/preparation", { action: "assessment_start", assessment_id: assessmentId });
      setScenario(data.scenario);
    } catch (e) {
      toast.error((e as Error).message);
      proctor.stop();
    } finally {
      setOpening(false);
    }
    await armed;
  }

  async function submit() {
    setBusy(true);
    try {
      await mutate("/api/preparation", { action: "assessment", assessment_id: assessmentId, answer, signals: proctor.signals });
      proctor.stop();
      toast.success("Submitted. Your placement cell will review it.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!proctor.examMode || !scenario) {
    return (
      <ProctorGate
        camera={proctor.camera}
        starting={proctor.starting || opening}
        onStart={start}
        title={`Start: ${title}`}
        rules={[
          "One sitting, one submission. The question appears when you press start.",
          "The page goes fullscreen and your camera stays on throughout.",
          "Pasting is disabled. Switching tabs or leaving this window ends the assessment.",
          "Your college reviews the result, and anything the camera flagged, before it can be shared with a company.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CameraPreview camera={proctor.camera} />
      {proctor.needsAcknowledgement && (
        <ProctorOverlay count={proctor.signals.blurCount} onResume={proctor.acknowledge} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Lock className="size-3.5" /> Exam conditions · pasting disabled · leaving this window ends the assessment
        </span>
        <span className="flex items-center gap-1.5">
          <Timer className="size-3.5" /> {proctor.fullscreen ? "Fullscreen" : "No fullscreen"}
        </span>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{scenario}</p>
      <label className="block text-sm">
        Your answer
        <textarea
          aria-label="Your answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={proctor.handlers.onKeyDown}
          onPaste={proctor.handlers.onPaste}
          minLength={200}
          maxLength={20000}
          rows={14}
          className={fieldClass}
          placeholder="State your assumptions, work through the numbers and defend a recommendation."
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground tabular">{answer.trim().length} / 200 characters minimum</span>
        <Button onClick={submit} disabled={busy || answer.trim().length < 200}>
          {busy ? "Submitting…" : "Submit assessment"}
        </Button>
      </div>
    </div>
  );
}
