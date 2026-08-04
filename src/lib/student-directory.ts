import { getDb } from "@/lib/firebase-admin";
import {
  normalizeCccd,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeText,
} from "@/lib/student-fields";
import { withFirestoreRetry } from "@/lib/student-cache";
import type { Student } from "@/lib/types";

/** Một document chứa toàn bộ danh bạ tìm kiếm (~310 SV << 1MB). */
export const DIRECTORY_PATH = "meta/studentDirectory";

export type DirectoryEntry = {
  maSinhVien: string;
  hoVaTen: string;
  emailCaNhan: string;
  soDienThoai: string;
  canCuoc: string;
  /** Precomputed match fields */
  name: string;
  nameFold: string;
  phone: string;
  email: string;
  cccd: string;
  ma: string;
};

type DirectoryDoc = {
  updatedAt?: string;
  count?: number;
  entries?: DirectoryEntry[];
};

const TTL_MS = 30 * 60 * 1000; // 30 phút / instance

let mem: { at: number; entries: DirectoryEntry[] } | null = null;
let inflight: Promise<DirectoryEntry[]> | null = null;

export function invalidateDirectoryCache() {
  mem = null;
}

export function foldDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

export function toDirectoryEntry(student: Student): DirectoryEntry {
  const maSinhVien = String(student.maSinhVien || "").trim();
  const hoVaTen = student.hoVaTen || "";
  const emailCaNhan = student.emailCaNhan || "";
  const soDienThoai = student.soDienThoai || "";
  const canCuoc = student.canCuoc || "";
  const name = normalizeName(hoVaTen);
  return {
    maSinhVien,
    hoVaTen,
    emailCaNhan,
    soDienThoai,
    canCuoc,
    name,
    nameFold: foldDiacritics(name),
    phone: normalizePhone(soDienThoai),
    email: normalizeEmail(emailCaNhan),
    cccd: normalizeCccd(canCuoc),
    ma: normalizeText(maSinhVien).toLowerCase(),
  };
}

export function entryToStudentStub(entry: DirectoryEntry): Student {
  return {
    maSinhVien: entry.maSinhVien,
    hoVaTen: entry.hoVaTen,
    emailCaNhan: entry.emailCaNhan,
    soDienThoai: entry.soDienThoai,
    canCuoc: entry.canCuoc,
    documents: {},
  };
}

function nameMatches(entry: DirectoryEntry, nameQ: string): boolean {
  if (nameQ.length < 2) return false;
  if (entry.name.includes(nameQ)) return true;
  const foldedQ = foldDiacritics(nameQ);
  if (foldedQ.length >= 2 && entry.nameFold.includes(foldedQ)) return true;
  const tokens = nameQ.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 1) {
    return tokens.every(
      (t) =>
        entry.name.includes(t) || entry.nameFold.includes(foldDiacritics(t))
    );
  }
  return false;
}

export type MatchKind = "name" | "phone" | "cccd" | "email" | "ma" | null;

/** Phân loại khớp — tránh email chứa "anh" làm nhiễu kết quả tên. */
export function classifyDirectoryMatch(
  entry: DirectoryEntry,
  query: string
): MatchKind {
  const q = normalizeText(query);
  if (!q) return null;

  const phoneQ = normalizePhone(q);
  const emailQ = normalizeEmail(q);
  const cccdQ = normalizeCccd(q);
  const nameQ = normalizeName(q);
  const idQ = normalizeText(q).toLowerCase();
  const looksLikeEmail = emailQ.includes("@");
  const looksLikePhone = phoneQ.length >= 9;
  const looksLikeId = /^\d{8,}$/.test(idQ);
  const looksLikeCccd = cccdQ.length >= 9 && /^\d+$/.test(cccdQ);

  if (nameMatches(entry, nameQ)) return "name";
  if (looksLikePhone && entry.phone.includes(phoneQ)) return "phone";
  if (looksLikeCccd && entry.cccd.includes(cccdQ)) return "cccd";
  // Chỉ match email khi query giống email (có @) — tránh "anh"/"van" khớp Gmail
  if (looksLikeEmail && emailQ.length >= 5 && entry.email.includes(emailQ)) {
    return "email";
  }
  if (looksLikeId && entry.ma.includes(idQ)) return "ma";
  // Mã SV / SĐT gõ một phần (không đủ dài để chắc) — vẫn cho khớp mã/SĐT
  if (!looksLikeEmail && idQ.length >= 4 && /^\d+$/.test(idQ) && entry.ma.includes(idQ)) {
    return "ma";
  }
  if (
    !looksLikeEmail &&
    phoneQ.length >= 4 &&
    phoneQ.length < 9 &&
    entry.phone.includes(phoneQ)
  ) {
    return "phone";
  }
  if (
    !looksLikeEmail &&
    cccdQ.length >= 4 &&
    cccdQ.length < 9 &&
    /^\d+$/.test(cccdQ) &&
    entry.cccd.includes(cccdQ)
  ) {
    return "cccd";
  }
  return null;
}

export function matchDirectoryEntry(
  entry: DirectoryEntry,
  query: string
): boolean {
  return classifyDirectoryMatch(entry, query) !== null;
}

async function loadDirectoryFromStore(): Promise<DirectoryEntry[]> {
  const db = getDb();
  const snap = await withFirestoreRetry(() => db.doc(DIRECTORY_PATH).get());
  if (snap.exists) {
    const data = snap.data() as DirectoryDoc;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length) {
      mem = { at: Date.now(), entries };
      return entries;
    }
  }
  const { entries } = await rebuildStudentDirectory();
  return entries;
}

/** Đọc danh bạ: ưu tiên RAM → 1 doc Firestore → rebuild nếu thiếu. */
export async function getDirectoryEntries(
  force = false
): Promise<DirectoryEntry[]> {
  if (!force && mem && Date.now() - mem.at < TTL_MS) {
    return mem.entries;
  }

  if (force) {
    // Không dùng chung inflight — luôn đọc mới
    return loadDirectoryFromStore();
  }

  if (inflight) return inflight;

  inflight = loadDirectoryFromStore();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function searchDirectory(
  query: string,
  limit = 8
): Promise<DirectoryEntry[]> {
  const entries = await getDirectoryEntries();
  const ranked: { entry: DirectoryEntry; kind: MatchKind; score: number }[] =
    [];

  for (const entry of entries) {
    const kind = classifyDirectoryMatch(entry, query);
    if (!kind) continue;
    // Ưu tiên khớp tên > mã > SĐT > CCCD > email
    const score =
      kind === "name"
        ? 5
        : kind === "ma"
          ? 4
          : kind === "phone"
            ? 3
            : kind === "cccd"
              ? 2
              : 1;
    ranked.push({ entry, kind, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.ma.localeCompare(b.entry.ma, "vi");
  });

  return ranked.slice(0, limit).map((r) => r.entry);
}

/** Ghi lại toàn bộ danh bạ từ collection students (admin / sau import). */
export async function rebuildStudentDirectory(
  students?: Student[]
): Promise<{ count: number; entries: DirectoryEntry[] }> {
  const db = getDb();
  let list = students;
  if (!list) {
    const snap = await withFirestoreRetry(() =>
      db
        .collection("students")
        .select(
          "hoVaTen",
          "emailCaNhan",
          "soDienThoai",
          "canCuoc",
          "maSinhVien"
        )
        .get()
    );
    list = snap.docs.map((d) => ({
      ...(d.data() as Student),
      maSinhVien: d.id,
    }));
  }

  const seen = new Set<string>();
  const entries: DirectoryEntry[] = [];
  for (const student of list) {
    const entry = toDirectoryEntry(student);
    if (!entry.maSinhVien || seen.has(entry.maSinhVien)) continue;
    seen.add(entry.maSinhVien);
    entries.push(entry);
  }
  entries.sort((a, b) => a.ma.localeCompare(b.ma, "vi"));

  await withFirestoreRetry(() =>
    db.doc(DIRECTORY_PATH).set({
      updatedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    })
  );

  mem = { at: Date.now(), entries };
  return { count: entries.length, entries };
}

/**
 * Cập nhật 1 SV trong danh bạ bằng transaction — tránh ghi đè lẫn nhau
 * khi nhiều request admin sửa đồng thời.
 */
export async function upsertDirectoryEntry(student: Student): Promise<void> {
  const entry = toDirectoryEntry(student);
  if (!entry.maSinhVien) return;

  const db = getDb();
  const ref = db.doc(DIRECTORY_PATH);

  const entries = await withFirestoreRetry(() =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? (snap.data() as DirectoryDoc) : {};
      const map = new Map<string, DirectoryEntry>();
      for (const e of prev.entries || []) {
        if (e?.maSinhVien) map.set(e.maSinhVien, e);
      }
      map.set(entry.maSinhVien, entry);
      const next = [...map.values()].sort((a, b) =>
        a.ma.localeCompare(b.ma, "vi")
      );
      tx.set(ref, {
        updatedAt: new Date().toISOString(),
        count: next.length,
        entries: next,
      });
      return next;
    })
  );

  mem = { at: Date.now(), entries };
}
