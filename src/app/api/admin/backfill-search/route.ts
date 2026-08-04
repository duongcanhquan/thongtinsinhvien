import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import {
  backfillSearchMeta,
  isQuotaExceededError,
  quotaExceededMessage,
  rebuildStudentDirectory,
} from "@/lib/students-repo";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/backfill-search
 * - rebuildOnly=1 → chỉ rebuild meta/studentDirectory (nhanh, tiết kiệm)
 * - mặc định → backfill searchTokens + rebuild directory
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const rebuildOnly = url.searchParams.get("rebuildOnly") === "1";

    if (rebuildOnly) {
      const dir = await rebuildStudentDirectory();
      return NextResponse.json({ ok: true, directoryCount: dir.count });
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
