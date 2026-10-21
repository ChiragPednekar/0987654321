import "server-only";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { isPdf } from "@/lib/deck";

/**
 * Reads the text out of an uploaded résumé (PDF or Word). The file is read in
 * memory and dropped — nothing is stored; only the bullets picked from it go
 * back to the page, where the student edits them before any critique.
 */

/** Under the ~4.5 MB request-body cap serverless functions impose. */
export const RESUME_FILE_MAX_BYTES = 4 * 1024 * 1024;

export type ResumeFileKind = "pdf" | "docx";

/** A .docx is a zip archive: it starts "PK\x03\x04". */
function isZip(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** What the file really is, from its bytes — never from its name alone. */
export function resumeFileKind(bytes: Uint8Array, name: string): ResumeFileKind | null {
  if (isPdf(bytes)) return "pdf";
  if (isZip(bytes) && /\.docx$/i.test(name)) return "docx";
  return null;
}

export async function readResumeText(bytes: Uint8Array, kind: ResumeFileKind): Promise<string> {
  if (kind === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}
