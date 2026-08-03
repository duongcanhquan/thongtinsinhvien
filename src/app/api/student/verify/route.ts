import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createStudentSession } from "@/lib/session";
import { getStudent, toIdentity } from "@/lib/students-repo";
import {
  normalizeCccd,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "@/lib/student-fields";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    const limited = rateLimit(`verify:${ip}`, 20, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Thử lại sau." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      maSinhVien?: string;
      hoVaTen?: string;
      emailCaNhan?: string;
      soDienThoai?: string;
      canCuoc?: string;
    };

    if (!body.maSinhVien) {
      return NextResponse.json({ error: "Thiếu mã sinh viên" }, { status: 400 });
    }

    const student = await getStudent(body.maSinhVien);
    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
    }

    const identity = toIdentity(student);
    const ok =
      normalizeName(body.hoVaTen) === normalizeName(identity.hoVaTen) &&
      normalizeEmail(body.emailCaNhan) === normalizeEmail(identity.emailCaNhan) &&
      normalizePhone(body.soDienThoai) === normalizePhone(identity.soDienThoai) &&
      normalizeCccd(body.canCuoc) === normalizeCccd(identity.canCuoc);

    if (!ok) {
      return NextResponse.json(
        { error: "Thông tin xác minh không khớp hồ sơ." },
        { status: 403 }
      );
    }

    await createStudentSession(student.maSinhVien);
    return NextResponse.json({ ok: true, maSinhVien: student.maSinhVien });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
