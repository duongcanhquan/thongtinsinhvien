import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { findStudentsByQuery, toIdentity } from "@/lib/students-repo";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    const limited = rateLimit(`search:${ip}`, 30, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Thử lại sau." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { query?: string };
    const query = (body.query || "").trim();
    if (query.length < 3) {
      return NextResponse.json(
        { error: "Nhập ít nhất 3 ký tự để tìm." },
        { status: 400 }
      );
    }

    const matches = await findStudentsByQuery(query);
    if (matches.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Prefer exact-ish single match; if many names, return all identities for confirm UI (user said 4-field match uniqueness)
    const identities = matches.map(toIdentity);
    return NextResponse.json({ matches: identities });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
