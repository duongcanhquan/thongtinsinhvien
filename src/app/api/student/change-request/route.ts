import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/session";
import { DOCUMENT_KEYS, STUDENT_EDITABLE_FIELDS } from "@/lib/student-fields";
import { getStudent, saveChangeRequest } from "@/lib/students-repo";
import type { ChangeRequest, DocumentSlot } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const student = await getStudent(session.maSinhVien);
    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
    }

    const body = (await req.json()) as {
      proposedFields?: Record<string, unknown>;
      proposedDocuments?: Record<string, DocumentSlot>;
    };

    const proposedFields: ChangeRequest["proposedFields"] = {};
    for (const key of STUDENT_EDITABLE_FIELDS) {
      if (body.proposedFields && key in body.proposedFields) {
        const value = body.proposedFields[key];
        (proposedFields as Record<string, unknown>)[key] =
          value == null ? "" : String(value);
      }
    }

    const proposedDocuments: Record<string, DocumentSlot> = {};
    if (body.proposedDocuments) {
      for (const [key, slot] of Object.entries(body.proposedDocuments)) {
        if (!DOCUMENT_KEYS.has(key)) continue;
        const files = (slot.files || []).slice(0, 2);
        proposedDocuments[key] = {
          status: files.length ? "co_file" : slot.status || "du",
          files,
          note: slot.note,
        };
      }
    }

    const now = new Date().toISOString();
    const request: ChangeRequest = {
      maSinhVien: session.maSinhVien,
      status: "pending",
      proposedFields,
      proposedDocuments,
      createdAt: now,
      updatedAt: now,
    };

    await saveChangeRequest(request);
    return NextResponse.json({ ok: true, request });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
