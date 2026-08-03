import { NextResponse } from "next/server";
import { DOCUMENT_KEYS, STUDENT_EDITABLE_FIELDS } from "@/lib/student-fields";
import { getAdminSession } from "@/lib/session";
import { getStudent, upsertStudent } from "@/lib/students-repo";
import type { DocumentSlot, Student } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;
    const student = await getStudent(id);
    if (!student) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ student });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;
    const student = await getStudent(id);
    if (!student) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      fields?: Record<string, unknown>;
      documents?: Record<string, DocumentSlot>;
    };

    const next: Student = { ...student, maSinhVien: id };
    if (body.fields) {
      for (const key of STUDENT_EDITABLE_FIELDS) {
        if (key in body.fields) {
          (next as Record<string, unknown>)[key] = String(body.fields[key] ?? "");
        }
      }
    }
    if (body.documents) {
      next.documents = { ...(student.documents || {}) };
      for (const [key, slot] of Object.entries(body.documents)) {
        if (!DOCUMENT_KEYS.has(key)) continue;
        next.documents[key] = {
          status: slot.files?.length ? "co_file" : slot.status,
          files: (slot.files || []).slice(0, 2),
          note: slot.note,
        };
      }
    }
    next.updatedAt = new Date().toISOString();
    await upsertStudent(next);
    return NextResponse.json({ ok: true, student: next });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
