import { NextResponse } from "next/server";
import { createDownloadUrl } from "@/lib/r2";
import { getAdminSession, getStudentSession } from "@/lib/session";
import { getChangeRequest, getStudent } from "@/lib/students-repo";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Thiếu key" }, { status: 400 });
    }

    const admin = await getAdminSession();
    const student = await getStudentSession();
    if (!admin && !student) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!key.startsWith("students/")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (student && !admin) {
      const profile = await getStudent(student.maSinhVien);
      const pending = await getChangeRequest(student.maSinhVien);
      const allowed =
        key.startsWith(`students/${student.maSinhVien}/`) &&
        (fileInStudent(profile, key) || fileInPending(pending, key));
      if (!allowed) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const url = await createDownloadUrl(key);
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function fileInStudent(
  student: Awaited<ReturnType<typeof getStudent>>,
  key: string
) {
  if (!student?.documents) return false;
  return Object.values(student.documents).some((slot) =>
    slot.files?.some((f) => f.key === key)
  );
}

function fileInPending(
  pending: Awaited<ReturnType<typeof getChangeRequest>>,
  key: string
) {
  if (!pending || pending.status !== "pending") return false;
  return Object.values(pending.proposedDocuments || {}).some((slot) =>
    slot.files?.some((f) => f.key === key)
  );
}
