import { NextResponse } from "next/server";
import {
  DOCUMENT_KEYS,
  STUDENT_EDITABLE_FIELDS,
} from "@/lib/student-fields";
import { getAdminSession } from "@/lib/session";
import {
  emptyDocuments,
  searchStudentsAdmin,
  studentExists,
  upsertStudent,
} from "@/lib/students-repo";
import type { DocumentSlot, Student } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const q = new URL(req.url).searchParams.get("q") || "";
    const students = await searchStudentsAdmin(q);
    return NextResponse.json({ students });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as {
      maSinhVien?: string;
      fields?: Record<string, unknown>;
      documents?: Record<string, DocumentSlot>;
    };

    const maSinhVien = String(body.maSinhVien || "").trim();
    if (!maSinhVien) {
      return NextResponse.json({ error: "Thiếu mã sinh viên" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(maSinhVien)) {
      return NextResponse.json(
        { error: "Mã sinh viên không hợp lệ (3–40 ký tự chữ/số)" },
        { status: 400 }
      );
    }

    if (await studentExists(maSinhVien)) {
      return NextResponse.json(
        { error: "Mã sinh viên đã tồn tại" },
        { status: 409 }
      );
    }

    const allowed = new Set<string>(["stt", ...STUDENT_EDITABLE_FIELDS]);
    const student: Student = {
      maSinhVien,
      hoVaTen: "",
      documents: emptyDocuments(),
    };

    if (body.fields) {
      for (const key of Object.keys(body.fields)) {
        if (!allowed.has(key)) continue;
        (student as Record<string, unknown>)[key] = String(
          body.fields[key] ?? ""
        );
      }
    }

    student.hoVaTen = String(student.hoVaTen || "").trim();
    if (!student.hoVaTen) {
      return NextResponse.json(
        { error: "Thiếu họ và tên sinh viên" },
        { status: 400 }
      );
    }

    if (body.documents) {
      for (const [key, slot] of Object.entries(body.documents)) {
        if (!DOCUMENT_KEYS.has(key)) continue;
        const files = (slot.files || []).slice(0, 2);
        for (const file of files) {
          if (
            !String(file.key || "").startsWith(
              `students/${maSinhVien}/${key}/`
            )
          ) {
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
        if (slot.note) entry.note = String(slot.note);
        if (slot.externalUrl) {
          entry.externalUrl = String(slot.externalUrl).slice(0, 2000);
        }
        student.documents[key] = entry;
      }
    }

    const now = new Date().toISOString();
    student.createdAt = now;
    student.updatedAt = now;
    await upsertStudent(student);

    return NextResponse.json({ ok: true, student }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
