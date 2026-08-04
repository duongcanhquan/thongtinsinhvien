import { getDb } from "@/lib/firebase-admin";
import type { Student } from "@/lib/types";

const TTL_MS = 60 * 60 * 1000; // 60 phút — chỉ dùng cho export / backfill full

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
  return [
    "Firestore vẫn từ chối truy cập (RESOURCE_EXHAUSTED) dù đã nâng Blaze.",
    "Kiểm tra nhanh:",
    "1) Google Cloud Console → App Engine → Application settings → bỏ/nâng Daily spending limit (hay bị kẹt $0).",
    "2) Firebase đúng project đang gắn billing Active (không phải project khác).",
    "3) Đợi 5–15 phút sau khi bật Blaze rồi hard-refresh trang.",
  ].join(" ");
}

export function firestoreErrorDetail(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 300);
  return String(e ?? "").slice(0, 300);
}

/** Retry ngắn — sau khi bật Blaze, Google đôi khi còn trả quota lỗi tạm thời. */
export async function withFirestoreRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isQuotaExceededError(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

/** Full student list cached in-memory per serverless instance. */
export async function getCachedStudents(force = false): Promise<Student[]> {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) {
    return cache.students;
  }

  if (!force && inflight) return inflight;

  inflight = (async () => {
    const db = getDb();
    const snap = await withFirestoreRetry(() => db.collection("students").get());
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
