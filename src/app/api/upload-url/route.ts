import { NextResponse } from "next/server";
import { buildObjectKey, createUploadUrl, guessContentType } from "@/lib/r2";
import { getStudentSession, getAdminSession } from "@/lib/session";
import { DOCUMENT_KEYS } from "@/lib/student-fields";

export async function POST(req: Request) {
  try {
    const student = await getStudentSession();
    const admin = await getAdminSession();
    if (!student && !admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as {
      maSinhVien?: string;
      fieldKey?: string;
      filename?: string;
      contentType?: string;
      size?: number;
    };

    const maSinhVien = admin ? body.maSinhVien : student?.maSinhVien;

    if (!maSinhVien || !body.fieldKey || !body.filename || !body.size) {
      return NextResponse.json({ error: "Thiếu tham số upload" }, { status: 400 });
    }

    if (!DOCUMENT_KEYS.has(body.fieldKey)) {
      return NextResponse.json({ error: "Trường giấy tờ không hợp lệ" }, { status: 400 });
    }

    if (student && student.maSinhVien !== maSinhVien) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const key = buildObjectKey(maSinhVien, body.fieldKey, body.filename);
    const contentType = guessContentType(body.filename, body.contentType || "");
    const signed = await createUploadUrl({
      key,
      contentType,
      size: body.size,
    });

    return NextResponse.json({
      url: signed.url,
      key: signed.key,
      name: body.filename,
      size: body.size,
      contentType: signed.contentType,
      uploadedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
