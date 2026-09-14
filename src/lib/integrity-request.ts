import { z } from "zod";
import { EMPTY_SIGNALS } from "@/lib/integrity";

/**
 * How proctor telemetry is accepted over the wire.
 *
 * Kept in its own module rather than in integrity.ts because that file is
 * imported by the client hook, and putting zod there would bundle a validator
 * into every browser that only ever needs the types.
 *
 * Every field is bounded. These numbers come from the browser and a student
 * with devtools can send anything, so the bounds are not a trust measure —
 * they stop a hostile payload storing nonsense in the audit trail a teacher
 * later reads. The actual defence against forged signals is that
 * src/lib/integrity.ts never lets them convict on their own, and that elapsed
 * time is taken from the server's own clock.
 *
 * Defaulted rather than required: a client that sends nothing is treated as
 * having reported nothing, which assessIntegrity handles as an absence of
 * evidence rather than as evidence of innocence.
 */
export const signalsSchema = z
  .object({
    keystrokes: z.number().int().min(0).max(1_000_000).default(0),
    pasteCount: z.number().int().min(0).max(10_000).default(0),
    pastedChars: z.number().int().min(0).max(1_000_000).default(0),
    largestPaste: z.number().int().min(0).max(1_000_000).default(0),
    blurCount: z.number().int().min(0).max(10_000).default(0),
    blurMs: z.number().int().min(0).max(86_400_000).default(0),
    fullscreenExits: z.number().int().min(0).max(10_000).default(0),
    proctored: z.boolean().default(false),
  })
  .default(EMPTY_SIGNALS);
