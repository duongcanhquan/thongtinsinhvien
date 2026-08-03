import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { getStudent, listPendingRequests, toIdentity } from "@/lib/students-repo";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const requests = await listPendingRequests();
    requests.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const student = await getStudent(r.maSinhVien);
        return {
          ...r,
          student: student
            ? toIdentity(student)
            : {
                maSinhVien: r.maSinhVien,
                hoVaTen: "",
                emailCaNhan: "",
                soDienThoai: "",
                canCuoc: "",
              },
        };
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
