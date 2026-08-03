import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { searchStudentsAdmin } from "@/lib/students-repo";

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
