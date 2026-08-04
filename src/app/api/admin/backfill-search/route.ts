import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import {
  backfillSearchMeta,
  isQuotaExceededError,
  quotaExceededMessage,
} from "@/lib/students-repo";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/admin/backfill-search — ghi searchTokens/hoVaTenLower cho mọi hồ sơ. */
export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const result = await backfillSearchMeta();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (isQuotaExceededError(e)) {
      return NextResponse.json(
        { error: quotaExceededMessage() },
        { status: 503 }
      );
    }
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
