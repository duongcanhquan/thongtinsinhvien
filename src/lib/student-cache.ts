import { getDb } from "@/lib/firebase-admin";
import type { Student } from "@/lib/types";

const TTL_MS = 10 * 60 * 1000; // 10 phút / instance — tránh full scan mỗi lần gõ

type CacheState = {
  loadedAt: number;
  students: Student[];
};

let cache: CacheState | null = null;
let inflight: Promise<Student[]> | null = null;

export function invalidateStudentCache() {
  cache = null;
}

export function isQuotaExceededError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e || "");
  const code =
    typeof e === "object" && e && "code" in e
      ? String((e as { code?: unknown }).code ?? "")
      : "";
  return (
    /RESOURCE_EXHAUSTED|Quota Exceeded|quota exceeded|exceeded your .*quota/i.test(
      msg
    ) ||
    code === "8" ||
    code === "resource-exhausted"
  );
}

export function quotaExceededMessage() {
  return "Firestore đã hết hạn mức miễn phí trong ngày (đọc/ghi). Thử lại sau khi quota reset (khoảng 0h giờ Mỹ ≈ 14–15h VN) hoặc bật Blaze/Billing trên Firebase Console.";
}

/** Full student list cached in-memory per serverless instance. */
export async function getCachedStudents(force = false): Promise<Student[]> {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) {
    return cache.students;
  }

  if (!force && inflight) return inflight;

  inflight = (async () => {
    const db = getDb();
    const snap = await db.collection("students").get();
    const students = snap.docs.map((d) => ({
      ...(d.data() as Student),
      maSinhVien: d.id,
    }));
    cache = { loadedAt: Date.now(), students };
    return students;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
