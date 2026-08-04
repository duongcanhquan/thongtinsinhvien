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
  return /RESOURCE_EXHAUSTED|Quota exceeded|exceeded your .*quota/i.test(msg);
}

export function quotaExceededMessage() {
  return "Hệ thống đang quá tải (hết hạn mức dữ liệu). Vui lòng thử lại sau vài phút.";
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
