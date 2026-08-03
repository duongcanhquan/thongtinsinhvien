import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { getDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/students-repo";
import type { ChangeRequest, DocumentSlot, Student } from "@/lib/types";
import { DOCUMENT_KEYS, STUDENT_EDITABLE_FIELDS } from "@/lib/student-fields";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin là cổng cuối:
 * - reject: xóa request, KHÔNG đụng bản ghi sinh viên chính thức
 * - approve / edit_approve: ghi đề xuất (có thể chỉnh bởi admin) vào official rồi xóa request
 */
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

    if (!["approve", "reject", "edit_approve"].includes(body.action)) {
      return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
    }

    const db = getDb();
    const requestRef = db.collection("changeRequests").doc(maSinhVien);
    const studentRef = db.collection("students").doc(maSinhVien);

    const result = await db.runTransaction(async (tx) => {
      const [reqSnap, stuSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(studentRef),
      ]);

      if (!reqSnap.exists) {
        throw Object.assign(new Error("Không có request pending"), { status: 404 });
      }
      const existing = reqSnap.data() as ChangeRequest;
      if (existing.status !== "pending") {
        throw Object.assign(new Error("Không có request pending"), { status: 404 });
      }

      if (!stuSnap.exists) {
        throw Object.assign(new Error("Không tìm thấy sinh viên"), { status: 404 });
      }
      const student = {
        ...(stuSnap.data() as Student),
        maSinhVien: stuSnap.id,
      };

      // REJECT — giữ nguyên hồ sơ chính thức
      if (body.action === "reject") {
        tx.delete(requestRef);
        return { rejected: true as const };
      }

      const fieldOverlay = sanitizeFields(body.proposedFields);
      const fields =
        body.action === "edit_approve" && body.proposedFields
          ? { ...existing.proposedFields, ...fieldOverlay }
          : existing.proposedFields;

      const hasClientDocs =
        body.action === "edit_approve" &&
        body.proposedDocuments &&
        Object.keys(body.proposedDocuments).length > 0;

      const docs = hasClientDocs
        ? body.proposedDocuments!
        : existing.proposedDocuments || {};

      // Validate file ownership before writing official
      for (const [key, slot] of Object.entries(docs)) {
        if (!DOCUMENT_KEYS.has(key)) continue;
        for (const file of slot.files || []) {
          if (!String(file.key || "").startsWith(`students/${maSinhVien}/${key}/`)) {
            throw Object.assign(new Error(`File không hợp lệ: ${key}`), {
              status: 400,
            });
          }
        }
      }

      const next: Student = stripUndefined({
        ...student,
        ...sanitizeFields(fields),
        maSinhVien: student.maSinhVien,
        documents: mergeDocuments(student.documents || {}, docs),
        updatedAt: new Date().toISOString(),
        createdAt: student.createdAt || new Date().toISOString(),
      });

      tx.set(studentRef, next, { merge: true });
      tx.delete(requestRef);
      return { rejected: false as const, student: next };
    });

    if (result.rejected) {
      return NextResponse.json({ ok: true, rejected: true });
    }
    return NextResponse.json({ ok: true, student: result.student });
  } catch (e) {
    const status =
      e && typeof e === "object" && "status" in e
        ? Number((e as { status: number }).status)
        : 500;
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json(
      { error: message },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}

function sanitizeFields(fields: Record<string, unknown> | undefined) {
  const out: Record<string, string> = {};
  if (!fields) return out;
  const allowed = new Set<string>(STUDENT_EDITABLE_FIELDS);
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.has(k)) continue;
    const s = v == null ? "" : String(v);
    out[k] = s.length > 2000 ? s.slice(0, 2000) : s;
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
    const files = (slot.files || []).slice(0, 2);
    const entry: DocumentSlot = {
      status: files.length ? "co_file" : slot.status || "thieu",
      files,
    };
    if (slot.note) entry.note = String(slot.note).slice(0, 500);
    next[key] = entry;
  }
  return next;
}
