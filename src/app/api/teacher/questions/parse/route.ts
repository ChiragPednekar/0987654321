import { NextResponse, type NextRequest } from "next/server";
import { authzResponse, requireTeacherActor } from "@/lib/authz";
import {
  MAX_UPLOAD_BYTES,
  UploadError,
  parseUpload,
} from "@/lib/parse-question";

// Reading a document is CPU work, not a model call, but a large .docx still
// takes a moment.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Extracts draft question fields from an uploaded document (spec §14).
 *
 * This endpoint deliberately writes nothing. It returns text for the teacher to
 * review and edit; publishing goes through POST /api/teacher/questions as
 * normal, so uploaded content can never reach students without a teacher
 * looking at it first.
 *
 * The file itself is discarded once parsed — see lib/parse-question for why.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  // Refuse oversized uploads on the header, before anything is buffered. A
  // limit checked only after reading the body is a limit that still lets an
  // attacker make the server read the body.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES * 1.1) {
    return NextResponse.json(
      {
        error: `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      },
      { status: 413 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload." },
      { status: 400 },
    );
  }

  if (!file) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  // Content-Length can lie; the actual bytes cannot.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      },
      { status: 413 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // file.name is attacker-controlled and is used only to pick a parser —
    // never to write anything to disk, so there is no path traversal here.
    const parsed = await parseUpload(file.name, bytes);

    return NextResponse.json({
      ...parsed,
      source: {
        // Echoed back for the teacher's benefit; the value is not trusted.
        name: file.name.slice(0, 200),
        bytes: file.size,
      },
    });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Parsing arbitrary documents can fail in ways no library documents. The
    // teacher gets something actionable; the detail stays in the server log.
    console.error("[question-upload] parse failed", {
      actor: actor.id,
      name: file.name.slice(0, 200),
      error,
    });
    return NextResponse.json(
      { error: "That file could not be read. Try pasting the text instead." },
      { status: 422 },
    );
  }
}
