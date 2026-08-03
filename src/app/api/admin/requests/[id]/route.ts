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
 * - approve / edit_approve: ghi đề xuất vào official rồi xóa request
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

    // Đọc ngoài transaction trước để trả lỗi rõ; ghi trong transaction
    const [reqSnap0, stuSnap0] = await Promise.all([
      requestRef.get(),
      studentRef.get(),
    ]);

    if (!reqSnap0.exists) {
      return NextResponse.json({ error: "Không có request pending" }, { status: 404 });
    }
    const existing0 = reqSnap0.data() as ChangeRequest;
    if (existing0.status !== "pending") {
      return NextResponse.json({ error: "Không có request pending" }, { status: 404 });
    }
    if (!stuSnap0.exists) {
      return NextResponse.json({ error: "Không tìm thấy sinh viên" }, { status: 404 });
    }

    if (body.action === "reject") {
      await requestRef.delete();
      return NextResponse.json({ ok: true, rejected: true });
    }

    // Xây patch trường: ưu tiên đề xuất đã lưu trên server, overlay chỉnh sửa của admin
    const fromRequest = sanitizeFields(existing0.proposedFields);
    const fromAdmin =
      body.action === "edit_approve" ? sanitizeFields(body.proposedFields) : {};
    const fieldsToApply = { ...fromRequest, ...fromAdmin };

    const docsFromRequest = existing0.proposedDocuments || {};
    const docsFromAdmin =
      body.action === "edit_approve" &&
      body.proposedDocuments &&
      Object.keys(body.proposedDocuments).length > 0
        ? body.proposedDocuments
        : null;
    const docsToApply = docsFromAdmin || docsFromRequest;

    for (const [key, slot] of Object.entries(docsToApply)) {
      if (!DOCUMENT_KEYS.has(key)) continue;
      for (const file of slot.files || []) {
        if (!String(file.key || "").startsWith(`students/${maSinhVien}/${key}/`)) {
          return NextResponse.json(
            { error: `File không hợp lệ: ${key}` },
            { status: 400 }
          );
        }
      }
    }

    const appliedKeys = Object.keys(fieldsToApply);
    if (appliedKeys.length === 0 && Object.keys(docsToApply).length === 0) {
      // Confirm không đổi gì — vẫn xóa request
      if (existing0.intent === "confirm") {
        await requestRef.delete();
        return NextResponse.json({
          ok: true,
          student: { ...(stuSnap0.data() as Student), maSinhVien },
          appliedFields: [],
        });
      }
      return NextResponse.json(
        {
          error:
            "Không có trường/file nào để duyệt. Thử tải lại trang hoặc yêu cầu sinh viên gửi lại.",
        },
        { status: 400 }
      );
    }

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      const stuSnap = await tx.get(studentRef);

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

      // Re-resolve inside transaction (source of truth = Firestore request)
      const txFields = {
        ...sanitizeFields(existing.proposedFields),
        ...sanitizeFields(
          body.action === "edit_approve" ? body.proposedFields : undefined
        ),
      };
      const txDocs =
        body.action === "edit_approve" &&
        body.proposedDocuments &&
        Object.keys(body.proposedDocuments).length > 0
          ? body.proposedDocuments
          : existing.proposedDocuments || {};

      const next = stripUndefined({
        ...student,
        ...txFields,
        maSinhVien: student.maSinhVien,
        documents: mergeDocuments(student.documents || {}, txDocs),
        updatedAt: new Date().toISOString(),
        createdAt: student.createdAt || new Date().toISOString(),
      }) as Student;

      // Ghi đè toàn bộ document (không merge) để chắc chắn trường chính thức được cập nhật
      tx.set(studentRef, next);
      tx.delete(requestRef);

      return {
        student: next,
        appliedFields: Object.keys(txFields),
        appliedDocs: Object.keys(txDocs),
      };
    });

    // Đọc lại để xác nhận đã ghi
    const verify = await studentRef.get();
    const verified = verify.exists
      ? ({ ...(verify.data() as Student), maSinhVien: verify.id } as Student)
      : result.student;

    return NextResponse.json({
      ok: true,
      student: verified,
      appliedFields: result.appliedFields,
      appliedDocs: result.appliedDocs,
    });
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
