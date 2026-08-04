import { NextResponse } from "next/server";
import { getAdminProjectId, getDb } from "@/lib/firebase-admin";
import {
  firestoreErrorDetail,
  isQuotaExceededError,
  quotaExceededMessage,
  withFirestoreRetry,
} from "@/lib/student-cache";

/** Kiểm tra Firestore + project đang dùng (không lộ secret). */
export async function GET() {
  const projectId = getAdminProjectId();
  try {
    const db = getDb();
    const snap = await withFirestoreRetry(() =>
      db.collection("students").limit(1).get()
    );
    return NextResponse.json({
      ok: true,
      projectId,
      sampleCount: snap.size,
      planHint:
        "Nếu ok=true thì Blaze/billing đã thông. Nếu trước đó lỗi quota, hard-refresh trang chủ.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        projectId,
        error: isQuotaExceededError(e)
          ? quotaExceededMessage()
          : firestoreErrorDetail(e),
        detail: firestoreErrorDetail(e),
      },
      { status: 503 }
    );
  }
}
