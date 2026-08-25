import "server-only";

import mammoth from "mammoth";

/**
 * Turns an uploaded document into draft question fields (spec §14).
 *
 * The file is parsed and discarded — nothing is stored. That is a deliberate
 * choice rather than an omission: the end product is a `cases` row of text, so
 * the file is a means of getting text in, not an artifact anyone reads later.
 * Keeping it would mean a bucket, storage policies, signed URLs, orphan cleanup
 * when a draft is abandoned, and a public-bucket misconfiguration waiting to
 * happen — all for a copy of content the database already holds.
 *
 * Nothing here publishes. Extraction produces a draft the teacher reviews and
 * edits; the spec is explicit that uploaded content is never published without
 * confirmation, and the parser has no route to the database at all.
 */

/** A case question is prose. Anything larger is not one. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".txt", ".docx"] as const;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 422,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface ParsedQuestion {
  title: string | null;
  scenario: string;
  instructions: string | null;
  expectedFramework: string | null;
  modelAnswer: string | null;
  /** Surfaced so the teacher can see what was and was not recognised. */
  warnings: string[];
}

/**
 * Decides the real format from the file's own bytes, not its declared type.
 *
 * A browser's Content-Type is attacker-controlled — it is whatever the request
 * says it is. DOCX is a ZIP container, so it always starts `PK\x03\x04`; a file
 * claiming to be one that does not is rejected before any parser touches it.
 */
function sniff(name: string, bytes: Uint8Array): "docx" | "text" {
  const lower = name.toLowerCase();
  const extension = ACCEPTED_EXTENSIONS.find((e) => lower.endsWith(e));

  if (!extension) {
    throw new UploadError(
      `Upload a ${ACCEPTED_EXTENSIONS.join(", ")} file.`,
      415,
    );
  }

  const isZip =
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (extension === ".docx") {
    if (!isZip) {
      throw new UploadError(
        "That file is named .docx but is not a Word document.",
        415,
      );
    }
    return "docx";
  }

  // A .txt or .md that is secretly a ZIP is either a mistake or an attempt at
  // one; either way it is not the text file it claims to be.
  if (isZip) {
    throw new UploadError("That file is not plain text.", 415);
  }

  // Reject binary masquerading as text. A NUL byte in the first kilobyte is
  // the cheapest reliable tell.
  if (bytes.subarray(0, 1024).includes(0)) {
    throw new UploadError("That file is not plain text.", 415);
  }

  return "text";
}

async function readDocx(bytes: Uint8Array): Promise<string> {
  try {
    // extractRawText, not convertToHtml: the editor takes plain text, and HTML
    // from an untrusted document is markup nobody asked to render.
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    });
    return result.value;
  } catch {
    throw new UploadError(
      "That Word document could not be read. Try saving it again, or paste the text instead.",
      422,
    );
  }
}

/**
 * Splits document text into the editor's fields.
 *
 * Heading-driven and deliberately conservative: anything it cannot place with
 * confidence goes into the scenario, where the teacher will see it, rather than
 * being dropped. A parser that silently discards a paragraph is worse than one
 * that puts it in the wrong box.
 */
export function extractFields(raw: string): ParsedQuestion {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const warnings: string[] = [];

  if (!text) {
    throw new UploadError("That file is empty.", 422);
  }

  const lines = text.split("\n");

  // Section headings, in the shapes a teacher actually writes them: a markdown
  // heading, an ALL CAPS line, or a short bold-ish line ending in a colon.
  const SECTIONS: { field: keyof ParsedQuestion; patterns: RegExp[] }[] = [
    {
      field: "instructions",
      patterns: [/^(instructions?|task|your task|what to do|question|deliverable)s?\b/i],
    },
    {
      field: "expectedFramework",
      patterns: [/^(expected (approach|framework)|approach|framework|how to think)\b/i],
    },
    {
      field: "modelAnswer",
      patterns: [/^(model answer|reference answer|solution|answer key|marking notes?)\b/i],
    },
  ];

  function headingOf(line: string): keyof ParsedQuestion | null {
    const bare = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .replace(/:$/, "")
      .trim();

    // A heading is short. A paragraph that happens to begin with "Task" is not.
    if (!bare || bare.length > 60) return null;

    const looksLikeHeading =
      /^#{1,6}\s/.test(line) ||
      /^\*\*.+\*\*$/.test(line.trim()) ||
      line.trim().endsWith(":") ||
      (bare === bare.toUpperCase() && /[A-Z]/.test(bare));

    if (!looksLikeHeading) return null;

    for (const section of SECTIONS) {
      if (section.patterns.some((p) => p.test(bare))) return section.field;
    }
    return null;
  }

  // Title: the first markdown H1, else the first non-empty line if it reads
  // like a title rather than a sentence.
  let title: string | null = null;
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, "").trim();
      bodyStart = i + 1;
      break;
    }

    // A first line under 120 chars with no terminal full stop is almost always
    // a title. One that ends in a full stop is almost always prose.
    if (line.length <= 120 && !/[.!?]$/.test(line)) {
      title = line.replace(/^\*\*(.+)\*\*$/, "$1").trim();
      bodyStart = i + 1;
    }
    break;
  }

  if (!title) {
    warnings.push("No title found — add one before publishing.");
  }

  const buckets: Record<string, string[]> = {
    scenario: [],
    instructions: [],
    expectedFramework: [],
    modelAnswer: [],
  };
  let current = "scenario";

  for (let i = bodyStart; i < lines.length; i += 1) {
    const heading = headingOf(lines[i]);
    if (heading) {
      current = heading;
      continue;
    }
    buckets[current].push(lines[i]);
  }

  const clean = (parts: string[]) => parts.join("\n").trim() || null;

  const scenario = clean(buckets.scenario);
  if (!scenario) {
    throw new UploadError(
      "No case content found. The document needs a scenario before any Instructions heading.",
      422,
    );
  }

  const instructions = clean(buckets.instructions);
  if (!instructions) {
    warnings.push(
      'No "Instructions" section found — everything went into the scenario. Add what the student must do before publishing.',
    );
  }

  if (clean(buckets.modelAnswer)) {
    warnings.push(
      "A reference answer was found and kept out of the scenario. Students never see it.",
    );
  }

  return {
    title,
    scenario,
    instructions,
    expectedFramework: clean(buckets.expectedFramework),
    modelAnswer: clean(buckets.modelAnswer),
    warnings,
  };
}

/** Validates, reads and extracts. Never touches the database. */
export async function parseUpload(
  name: string,
  bytes: Uint8Array,
): Promise<ParsedQuestion> {
  if (bytes.length === 0) {
    throw new UploadError("That file is empty.", 422);
  }

  // Checked again here, not only at the route: a size limit enforced in one
  // place is a size limit one refactor away from being gone.
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      413,
    );
  }

  const kind = sniff(name, bytes);
  const text =
    kind === "docx"
      ? await readDocx(bytes)
      : new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  return extractFields(text);
}
