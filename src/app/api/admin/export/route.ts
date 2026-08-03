import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { listPendingRequests, listStudents } from "@/lib/students-repo";

export const runtime = "nodejs";

/** Export full Firestore snapshot for admin backup / offline review. */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const [students, pendingRequests] = await Promise.all([
      listStudents(),
      listPendingRequests(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      studentCount: students.length,
      pendingRequestCount: pendingRequests.length,
      students,
      pendingRequests,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="students-export-${payload.exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
