import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { getStudentSession } from "@/lib/session";
import { DOCUMENT_KEYS, STUDENT_EDITABLE_FIELDS } from "@/lib/student-fields";
import { getChangeRequest, getStudent, saveChangeRequest } from "@/lib/students-repo";
import type { ChangeRequest, DocumentSlot } from "@/lib/types";

const MAX_FIELD_LEN = 2000;

export async function POST(req: Request) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ip = getClientIp(req.headers);
    const limited = rateLimit(`change:${session.maSinhVien}:${ip}`, 30, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Thử lại sau." },
        { status: 429 }
      );
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
        const next = truncate(value == null ? "" : String(value));
        const prev = String((student as Record<string, unknown>)[key] ?? "");
        if (next === prev) continue;
        (proposedFields as Record<string, unknown>)[key] = next;
      }
    }

    const proposedDocuments: Record<string, DocumentSlot> = {};
    if (body.proposedDocuments) {
      for (const [key, slot] of Object.entries(body.proposedDocuments)) {
        if (!DOCUMENT_KEYS.has(key)) continue;

        // Mục Đủ: sinh viên không được tự đổi / upload — chỉ admin
        if (student.documents?.[key]?.status === "du") {
          continue;
        }

        const files = (slot.files || []).slice(0, 2).map((f) => ({
          key: String(f.key || ""),
          name: truncate(String(f.name || ""), 200),
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
          status: files.length ? "co_file" : slot.status || "thieu",
          files,
        };
        if (slot.note) entry.note = truncate(String(slot.note), 500);
        if (!documentSlotChanged(student.documents?.[key], entry)) continue;
        proposedDocuments[key] = entry;
      }
    }

    const hasFieldDiff = Object.keys(proposedFields).length > 0;
    const hasDocDiff = Object.keys(proposedDocuments).length > 0;
    const hasChanges = hasFieldDiff || hasDocDiff;

    const intent: ChangeRequest["intent"] =
      body.intent === "confirm" && !hasChanges ? "confirm" : "edit";

    const now = new Date().toISOString();
    const previous = await getChangeRequest(session.maSinhVien);
    const request: ChangeRequest = {
      maSinhVien: session.maSinhVien,
      status: "pending",
      intent,
      proposedFields,
      proposedDocuments,
      createdAt:
        previous?.status === "pending" && previous.createdAt
          ? previous.createdAt
          : now,
      updatedAt: now,
    };

    await saveChangeRequest(request);
    return NextResponse.json({ ok: true, request, intent, hasChanges });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function truncate(value: string, max = MAX_FIELD_LEN) {
  return value.length > max ? value.slice(0, max) : value;
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
