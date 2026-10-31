"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { writeStored } from "@/hooks/use-browser-state";
import { PENDING_BATCH_CODE_KEY, checkBatchCode, joinBatch } from "./batch-code";

/**
 * Campus Institutional Key. Signed in, the key is verified on the spot;
 * signed out, it is held and verified right after sign-in (see batch-code.ts).
 * Either way nothing claims the key worked until the server says so.
 */
export function CampusKeyModal({
  open,
  onOpenChange,
  signedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = checkBatchCode(key);
    if ("error" in checked) {
      setError(checked.error);
      return;
    }

    if (!signedIn) {
      writeStored(PENDING_BATCH_CODE_KEY, checked.code);
      toast(`Batch key ${checked.code} saved. Sign in and we'll verify it.`);
      setKey("");
      onOpenChange(false);
      return;
    }

    setBusy(true);
    const result = await joinBatch(checked.code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Batch key verified — you've joined the batch.");
    onOpenChange(false);
    router.push(`/classrooms/${result.classroomId}`);
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="signin-font fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cc-border bg-cc-card p-6 text-cc-ink shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-cc-border pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cc-accent/20 text-cc-accent">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <DialogPrimitive.Title className="text-sm font-bold text-cc-ink">
                  Campus Institutional Key
                </DialogPrimitive.Title>
                <p className="text-[11px] text-cc-muted">Activate placement batch or faculty license</p>
              </div>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="flex size-9 items-center justify-center rounded-lg text-cc-muted transition-colors hover:text-cc-ink"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="my-5 space-y-3">
              <DialogPrimitive.Description className="text-xs leading-relaxed text-cc-ink-2">
                Campus licences attach automatically when you sign in with your college email. If
                your placement committee (PlaceCom) or professor issued a 6-character batch key,
                enter it below to link your cohort workspace
                {signedIn ? "." : " — we'll verify it as soon as you sign in."}
              </DialogPrimitive.Description>
              <div>
                <label
                  htmlFor="batchKey"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-cc-muted"
                >
                  Batch Key
                </label>
                <input
                  id="batchKey"
                  type="text"
                  value={key}
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "batchKey-error" : undefined}
                  onChange={(event) => {
                    setKey(event.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. C8BTZ6"
                  className="w-full rounded-lg border border-cc-border bg-cc-obsidian px-3.5 py-2.5 font-mono text-sm uppercase tracking-[0.05em] text-cc-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-cc-muted focus:border-cc-accent aria-invalid:border-cc-vermilion"
                />
                {error && (
                  <p id="batchKey-error" role="alert" className="mt-1.5 text-[11px] text-cc-vermilion">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <DialogPrimitive.Close className="rounded-lg px-4 py-2 text-xs font-medium text-cc-muted hover:text-cc-ink">
                Cancel
              </DialogPrimitive.Close>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-cc-accent px-4 py-2 text-xs font-medium text-white shadow-md shadow-blue-500/20 hover:bg-cc-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                {signedIn ? "Verify & Activate" : "Save & Sign In"}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
