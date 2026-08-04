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
  const maSinhVien = student.maSinhVien || "";
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
  if (entry.nameFold.includes(foldedQ)) return true;
  const tokens = nameQ.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 1) {
    return tokens.every(
      (t) =>
        entry.name.includes(t) || entry.nameFold.includes(foldDiacritics(t))
    );
  }
  return false;
}

export function matchDirectoryEntry(
  entry: DirectoryEntry,
  query: string
): boolean {
  const q = normalizeText(query);
  if (!q) return false;
  const phoneQ = normalizePhone(q);
  const emailQ = normalizeEmail(q);
  const cccdQ = normalizeCccd(q);
  const nameQ = normalizeName(q);
  const idQ = normalizeText(q).toLowerCase();

  return (
    nameMatches(entry, nameQ) ||
    (phoneQ.length >= 3 && entry.phone.includes(phoneQ)) ||
    (cccdQ.length >= 3 && entry.cccd.includes(cccdQ)) ||
    (emailQ.length >= 3 && entry.email.includes(emailQ)) ||
    (idQ.length >= 3 && entry.ma.includes(idQ))
  );
}

/** Đọc danh bạ: ưu tiên RAM → 1 doc Firestore → rebuild nếu thiếu. */
export async function getDirectoryEntries(
  force = false
): Promise<DirectoryEntry[]> {
  if (!force && mem && Date.now() - mem.at < TTL_MS) {
    return mem.entries;
  }
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const db = getDb();
    const snap = await withFirestoreRetry(() =>
      db.doc(DIRECTORY_PATH).get()
    );
    if (snap.exists) {
      const data = snap.data() as DirectoryDoc;
      const entries = Array.isArray(data.entries) ? data.entries : [];
      if (entries.length) {
        mem = { at: Date.now(), entries };
        return entries;
      }
    }
    // Chưa có directory → rebuild 1 lần (tốn N reads, nhưng hiếm)
    const { entries } = await rebuildStudentDirectory();
    return entries;
  })();

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
  const out: DirectoryEntry[] = [];
  for (const entry of entries) {
    if (matchDirectoryEntry(entry, query)) {
      out.push(entry);
      if (out.length >= limit) break;
    }
  }
  return out;
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

  const entries = list
    .map(toDirectoryEntry)
    .filter((e) => e.maSinhVien)
    .sort((a, b) => a.ma.localeCompare(b.ma, "vi"));

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

/** Cập nhật 1 SV trong danh bạ (1 read + 1 write meta). */
export async function upsertDirectoryEntry(student: Student): Promise<void> {
  const entry = toDirectoryEntry(student);
  if (!entry.maSinhVien) return;

  const db = getDb();
  const ref = db.doc(DIRECTORY_PATH);
  const snap = await withFirestoreRetry(() => ref.get());
  const prev = snap.exists ? (snap.data() as DirectoryDoc) : {};
  const map = new Map<string, DirectoryEntry>();
  for (const e of prev.entries || []) {
    if (e?.maSinhVien) map.set(e.maSinhVien, e);
  }
  map.set(entry.maSinhVien, entry);
  const entries = [...map.values()].sort((a, b) =>
    a.ma.localeCompare(b.ma, "vi")
  );

  await withFirestoreRetry(() =>
    ref.set({
      updatedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    })
  );
  mem = { at: Date.now(), entries };
}
