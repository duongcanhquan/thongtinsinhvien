import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/session";
import { getChangeRequest, getStudent } from "@/lib/students-repo";

export async function GET() {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const student = await getStudent(session.maSinhVien);
    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
    }

    const pending = await getChangeRequest(session.maSinhVien);
    return NextResponse.json({
      student,
      pending: pending?.status === "pending" ? pending : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
