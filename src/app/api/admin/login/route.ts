import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    const expected = process.env.ADMIN_PASSWORD || "admin123";
    if (!body.password || body.password !== expected) {
      return NextResponse.json({ error: "Mật khẩu không đúng" }, { status: 401 });
    }
    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
