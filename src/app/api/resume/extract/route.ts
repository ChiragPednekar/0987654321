import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickBullets } from "@/lib/resume-bullets";
import { readResumeText, RESUME_FILE_MAX_BYTES, resumeFileKind } from "@/lib/resume-file";

export const dynamic = "force-dynamic";

const MB = Math.round(RESUME_FILE_MAX_BYTES / 1024 / 1024);

/**
 * Reads a résumé file and returns the bullets found in it, to fill the box on
 * /resume. No model call and no allowance used: the critique that follows is
 * what costs a graded answer, and the student edits the bullets first.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > RESUME_FILE_MAX_BYTES * 1.05) {
    return NextResponse.json({ error: `Résumé files must be under ${MB} MB.` }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > RESUME_FILE_MAX_BYTES) {
    return NextResponse.json({ error: `Résumé files must be under ${MB} MB.` }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = resumeFileKind(bytes, file.name);
  if (!kind) {
    return NextResponse.json({ error: "Upload a PDF or a Word (.docx) file." }, { status: 415 });
  }

  let text: string;
  try {
    text = await readResumeText(bytes, kind);
  } catch (error) {
    console.error("[resume] could not read file", error);
    return NextResponse.json(
      { error: "That file could not be read. Try exporting it again as PDF, or paste the bullets." },
      { status: 422 },
    );
  }

  const bullets = pickBullets(text);
  if (bullets.length === 0) {
    return NextResponse.json(
      {
        error:
          kind === "pdf" && text.trim().length < 40
            ? "No text found — this PDF looks like a scanned image. Paste your bullets instead."
            : "No bullet points found in that file. Paste them instead.",
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ bullets, kind });
}
