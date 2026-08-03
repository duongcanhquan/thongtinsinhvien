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
      intent?: "edit" | "confirm";
      proposedFields?: Record<string, unknown>;
      proposedDocuments?: Record<string, DocumentSlot>;
    };

    const proposedFields: ChangeRequest["proposedFields"] = {};
    for (const key of STUDENT_EDITABLE_FIELDS) {
      if (body.proposedFields && key in body.proposedFields) {
        const value = body.proposedFields[key];
        const next = value == null ? "" : String(value);
        const prev = String((student as Record<string, unknown>)[key] ?? "");
        if (next === prev) continue;
        (proposedFields as Record<string, unknown>)[key] = next;
      }
    }

    const proposedDocuments: Record<string, DocumentSlot> = {};
    if (body.proposedDocuments) {
      for (const [key, slot] of Object.entries(body.proposedDocuments)) {
        if (!DOCUMENT_KEYS.has(key)) continue;
        const files = (slot.files || []).slice(0, 2).map((f) => ({
          key: String(f.key || ""),
          name: String(f.name || ""),
          size: Number(f.size) || 0,
          contentType: String(f.contentType || ""),
          uploadedAt: String(f.uploadedAt || new Date().toISOString()),
        }));

        for (const file of files) {
          if (!isOwnedUploadKey(session.maSinhVien, key, file.key)) {
            return NextResponse.json(
              { error: `File không hợp lệ cho trường ${key}` },
              { status: 400 }
            );
          }
        }

        const entry: DocumentSlot = {
          status: files.length ? "co_file" : slot.status || "du",
          files,
        };
        if (slot.note) entry.note = String(slot.note);
        // Chỉ lưu slot thực sự khác bản chính thức — tránh ghi đè toàn bộ khi approve
        if (!documentSlotChanged(student.documents?.[key], entry)) continue;
        proposedDocuments[key] = entry;
      }
    }

    const hasFieldDiff = Object.keys(proposedFields).length > 0;
    const hasDocDiff = Object.keys(proposedDocuments).length > 0;
    const hasChanges = hasFieldDiff || hasDocDiff;

    // Nếu bấm "xác nhận đúng" nhưng form đã lệch bản gốc → vẫn coi là yêu cầu chỉnh sửa
    const intent: ChangeRequest["intent"] =
      body.intent === "confirm" && !hasChanges ? "confirm" : "edit";

    if (intent === "edit" && !hasChanges && body.intent === "edit") {
      // vẫn cho gửi (overwrite pending) — admin thấy SV gửi lại
    }

    const now = new Date().toISOString();
    const request: ChangeRequest = {
      maSinhVien: session.maSinhVien,
      status: "pending",
      intent,
      proposedFields,
      proposedDocuments,
      createdAt: now,
      updatedAt: now,
    };

    await saveChangeRequest(request);
    return NextResponse.json({ ok: true, request, intent, hasChanges });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function documentSlotChanged(
  current: DocumentSlot | undefined,
  next: DocumentSlot
) {
  const currKeys = (current?.files || []).map((f) => f.key).join("|");
  const nextKeys = (next.files || []).map((f) => f.key).join("|");
  if (currKeys !== nextKeys) return true;
  if ((next.status || "") !== (current?.status || "")) return true;
  if ((next.note || "") !== (current?.note || "")) return true;
  return false;
}

function isOwnedUploadKey(
  maSinhVien: string,
  fieldKey: string,
  key: string
) {
  if (!key) return false;
  return key.startsWith(`students/${maSinhVien}/${fieldKey}/`);
}
