import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import {
  deleteChangeRequest,
  getChangeRequest,
  getStudent,
  saveChangeRequest,
  upsertStudent,
} from "@/lib/students-repo";
import type { DocumentSlot, Student } from "@/lib/types";
import { DOCUMENT_KEYS, STUDENT_EDITABLE_FIELDS } from "@/lib/student-fields";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id: maSinhVien } = await params;
    const body = (await req.json()) as {
      action: "approve" | "reject" | "edit_approve";
      adminNote?: string;
      proposedFields?: Record<string, unknown>;
      proposedDocuments?: Record<string, DocumentSlot>;
    };

    const existing = await getChangeRequest(maSinhVien);
    if (!existing || existing.status !== "pending") {
      return NextResponse.json({ error: "Không có request pending" }, { status: 404 });
    }

    const student = await getStudent(maSinhVien);
    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy sinh viên" }, { status: 404 });
    }

    if (body.action === "reject") {
      await saveChangeRequest({
        ...existing,
        status: "rejected",
        adminNote: body.adminNote || "",
        updatedAt: new Date().toISOString(),
      });
      await deleteChangeRequest(maSinhVien);
      return NextResponse.json({ ok: true });
    }

    const fields =
      body.action === "edit_approve" && body.proposedFields
        ? body.proposedFields
        : existing.proposedFields;
    const docs =
      body.action === "edit_approve" && body.proposedDocuments
        ? body.proposedDocuments
        : existing.proposedDocuments;

    const next: Student = {
      ...student,
      ...sanitizeFields(fields),
      maSinhVien: student.maSinhVien,
      documents: mergeDocuments(student.documents || {}, docs || {}),
      updatedAt: new Date().toISOString(),
    };

    await upsertStudent(next);
    await deleteChangeRequest(maSinhVien);
    return NextResponse.json({ ok: true, student: next });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeFields(fields: Record<string, unknown> | undefined) {
  const out: Record<string, string> = {};
  if (!fields) return out;
  const allowed = new Set<string>(STUDENT_EDITABLE_FIELDS);
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.has(k)) continue;
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

function mergeDocuments(
  current: Record<string, DocumentSlot>,
  proposed: Record<string, DocumentSlot>
) {
  const next = { ...current };
  for (const [key, slot] of Object.entries(proposed)) {
    if (!DOCUMENT_KEYS.has(key)) continue;
    // Chỉ merge các slot có trong proposed (đã lọc diff phía student)
    const files = (slot.files || []).slice(0, 2);
    const entry: DocumentSlot = {
      status: files.length ? "co_file" : slot.status || "thieu",
      files,
    };
    if (slot.note) entry.note = String(slot.note);
    next[key] = entry;
  }
  return next;
}
