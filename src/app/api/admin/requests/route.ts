import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import {
  firestoreUserMessage,
  getStudent,
  listPendingRequests,
  toIdentity,
} from "@/lib/students-repo";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const requests = await listPendingRequests();
    requests.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    // Giới hạn enrich để tránh N+1 đọc quá nhiều khi quota thấp
    const capped = requests.slice(0, 100);
    const enriched = await Promise.all(
      capped.map(async (r) => {
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
    return NextResponse.json({ error: firestoreUserMessage(e) }, { status: 500 });
  }
}
