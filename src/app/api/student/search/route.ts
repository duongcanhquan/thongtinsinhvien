import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { findStudentsByQuery, toIdentity } from "@/lib/students-repo";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    const limited = rateLimit(`search:${ip}`, 90, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Thử lại sau." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { query?: string; limit?: number };
    const query = (body.query || "").trim();
    if (query.length < 2) {
      return NextResponse.json({ matches: [] });
    }

    const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 15);
    const matches = await findStudentsByQuery(query, limit);
    return NextResponse.json({ matches: matches.map(toIdentity) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
