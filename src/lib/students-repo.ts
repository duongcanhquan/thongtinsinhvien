import { getAdminProjectId, getDb } from "@/lib/firebase-admin";
import {
  ADMIN_EDITABLE_FIELDS,
  DOCUMENT_KEYS,
  cellToString,
  extractHttpUrl,
  inferDocumentStatus,
  normalizeCccd,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeText,
} from "@/lib/student-fields";
import {
  firestoreErrorDetail,
  getCachedStudents,
  invalidateStudentCache,
  isQuotaExceededError,
  quotaExceededMessage,
  withFirestoreRetry,
} from "@/lib/student-cache";
import {
  entryToStudentStub,
  getDirectoryEntries,
  rebuildStudentDirectory,
  searchDirectory,
  upsertDirectoryEntry,
} from "@/lib/student-directory";
import type {
  ChangeRequest,
  DocumentSlot,
  Student,
  StudentIdentity,
} from "@/lib/types";

export {
  firestoreErrorDetail,
  getCachedStudents,
  invalidateStudentCache,
  isQuotaExceededError,
  quotaExceededMessage,
  rebuildStudentDirectory,
};

export function quotaErrorPayload(error: unknown) {
  return {
    error: quotaExceededMessage(),
    detail: firestoreErrorDetail(error),
    projectId: getAdminProjectId(),
  };
}

function emptyDocuments(): Record<string, DocumentSlot> {
  const docs: Record<string, DocumentSlot> = {};
  for (const key of DOCUMENT_KEYS) {
    docs[key] = { status: "thieu", files: [] };
  }
  return docs;
}

export { emptyDocuments };

/** Remove undefined recursively — Firestore rejects undefined values. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export function studentFromFields(
  fields: Record<string, string>,
  externalUrls?: Record<string, string>
): Student | null {
  const maSinhVien = cellToString(fields.maSinhVien);
  if (!maSinhVien) return null;

  const documents = emptyDocuments();
  const student: Record<string, unknown> = {
    maSinhVien,
    hoVaTen: cellToString(fields.hoVaTen) || "",
    documents,
  };

  for (const [key, raw] of Object.entries(fields)) {
    if (key === "maSinhVien" || key === "hoVaTen") continue;
    const value = cellToString(raw);

    if (DOCUMENT_KEYS.has(key)) {
      const link =
        extractHttpUrl(externalUrls?.[key]) || extractHttpUrl(value);
      const slot: DocumentSlot = {
        status: link ? "du" : inferDocumentStatus(value),
        files: [],
      };
      // Giữ tên file / ghi chú text; không nhét raw URL vào note nếu đã có externalUrl
      if (value && !extractHttpUrl(value)) slot.note = value;
      else if (value && !link) slot.note = value;
      else if (value && link && value !== link) slot.note = value;
      if (link) slot.externalUrl = link;
      documents[key] = slot;
      continue;
    }

    // Always store string (never undefined) for scalar fields
    student[key] = value;
  }

  // Apply links for columns that only had hyperlink (empty display text)
  if (externalUrls) {
    for (const [key, url] of Object.entries(externalUrls)) {
      if (!DOCUMENT_KEYS.has(key)) continue;
      const link = extractHttpUrl(url);
      if (!link) continue;
      const slot = documents[key] || { status: "thieu", files: [] };
      slot.externalUrl = link;
      if (slot.status === "thieu") slot.status = "du";
      documents[key] = slot;
    }
  }

  student.documents = documents;
  return stripUndefined(student as Student);
}

/**
 * Ghi đè thông tin từ bản Excel lên hồ sơ đã có.
 * - Mọi trường dữ liệu có trong file mới → lấy theo file mới
 * - Giữ: createdAt, file R2 đã upload trên hệ thống
 * - Cập nhật: trạng thái giấy tờ, note, link Drive từ Excel
 */
export function mergeStudentFromImport(
  existing: Student,
  incoming: Student
): Student {
  const now = new Date().toISOString();
  const next: Record<string, unknown> = {
    ...existing,
    maSinhVien: existing.maSinhVien,
    createdAt: existing.createdAt || now,
    importedAt: now,
    updatedAt: now,
  };

  // Cập nhật toàn bộ trường thông tin theo Excel (kể cả ô trống)
  next.hoVaTen = String(incoming.hoVaTen ?? "");
  for (const key of ADMIN_EDITABLE_FIELDS) {
    if (key === "hoVaTen") continue;
    next[key] = String((incoming as Record<string, unknown>)[key] ?? "");
  }

  const prevDocs = existing.documents || {};
  const inDocs = incoming.documents || {};
  const documents: Record<string, DocumentSlot> = {};
  for (const key of DOCUMENT_KEYS) {
    const prev = prevDocs[key] || { status: "thieu" as const, files: [] };
    const inc = inDocs[key] || { status: "thieu" as const, files: [] };
    const slot: DocumentSlot = {
      status: inc.status || "thieu",
      files: prev.files?.length ? [...prev.files] : [],
    };
    if (inc.note) slot.note = String(inc.note);
    else if (prev.note) slot.note = prev.note;
    const url =
      extractHttpUrl(inc.externalUrl) || extractHttpUrl(prev.externalUrl);
    if (url) slot.externalUrl = url;
    // Có file R2 hoặc link Drive mà Excel để trống → không hạ xuống thiếu oan
    if (
      slot.status === "thieu" &&
      ((slot.files && slot.files.length > 0) || slot.externalUrl)
    ) {
      slot.status = slot.files?.length ? "co_file" : "du";
    }
    documents[key] = slot;
  }
  next.documents = documents;

  return stripUndefined(next as Student);
}

export function toIdentity(student: Student): StudentIdentity {
  return {
    maSinhVien: student.maSinhVien,
    hoVaTen: student.hoVaTen || "",
    emailCaNhan: student.emailCaNhan || "",
    soDienThoai: student.soDienThoai || "",
    canCuoc: student.canCuoc || "",
  };
}

/** Meta phục vụ tìm kiếm indexed — tránh quét cả collection (tốn quota). */
function buildSearchMeta(student: Student) {
  const name = normalizeName(student.hoVaTen);
  const phone = normalizePhone(student.soDienThoai);
  const email = normalizeEmail(student.emailCaNhan);
  const cccd = normalizeCccd(student.canCuoc);
  const ma = normalizeText(student.maSinhVien).toLowerCase();
  const tokens = new Set<string>();
  for (const part of name.split(/\s+/)) {
    if (part.length >= 2) tokens.add(part);
  }
  if (name.length >= 2) tokens.add(name);
  if (phone.length >= 3) tokens.add(phone);
  if (email.length >= 3) tokens.add(email);
  if (cccd.length >= 3) tokens.add(cccd);
  if (ma.length >= 3) tokens.add(ma);

  return {
    hoVaTenLower: name,
    soDienThoaiDigits: phone,
    emailCaNhanLower: email,
    canCuocDigits: cccd,
    searchTokens: [...tokens].slice(0, 40),
  };
}

export function isFirestoreQuotaError(error: unknown): boolean {
  return isQuotaExceededError(error);
}

export function firestoreUserMessage(error: unknown): string {
  if (isQuotaExceededError(error)) {
    return quotaExceededMessage();
  }
  return error instanceof Error ? error.message : "Lỗi máy chủ";
}

/**
 * Tìm SV qua meta/studentDirectory (1 read / TTL) — không quét collection.
 * Trả stub đủ 4 định danh; hồ sơ đầy đủ chỉ load khi verify/me.
 */
export async function findStudentsByQuery(
  query: string,
  limit = 8
): Promise<Student[]> {
  const q = normalizeText(query);
  if (!q) return [];

  // Mã SV đúng → 1 doc read (đủ cho confirm nhanh)
  const idQ = normalizeText(q);
  if (/^\d{8,}$/.test(idQ)) {
    const exact = await getStudent(idQ);
    if (exact) return [exact];
  }

  const entries = await searchDirectory(q, limit);
  return entries.map(entryToStudentStub);
}

/** Backfill searchTokens + rebuild danh bạ 1-doc. */
export async function backfillSearchMeta(): Promise<{
  total: number;
  updated: number;
  directoryCount: number;
}> {
  const all = await getCachedStudents(true);
  const db = getDb();
  const CHUNK = 400;
  let updated = 0;

  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const student of chunk) {
      const meta = buildSearchMeta(student);
      batch.set(
        db.collection("students").doc(student.maSinhVien),
        stripUndefined(meta),
        { merge: true }
      );
      updated += 1;
    }
    await batch.commit();
  }

  const dir = await rebuildStudentDirectory(all);
  invalidateStudentCache();
  return { total: all.length, updated, directoryCount: dir.count };
}

export async function getStudent(maSinhVien: string): Promise<Student | null> {
  const db = getDb();
  const doc = await withFirestoreRetry(() =>
    db.collection("students").doc(maSinhVien).get()
  );
  if (!doc.exists) return null;
  return { ...(doc.data() as Student), maSinhVien: doc.id };
}

export async function upsertStudent(student: Student) {
  const db = getDb();
  const now = new Date().toISOString();
  const searchMeta = buildSearchMeta(student);
  const payload = stripUndefined({
    ...student,
    ...searchMeta,
    maSinhVien: student.maSinhVien,
    hoVaTen: student.hoVaTen || "",
    documents: student.documents || emptyDocuments(),
    updatedAt: now,
    createdAt: student.createdAt || now,
  });
  await db.collection("students").doc(student.maSinhVien).set(payload, {
    merge: true,
  });
  invalidateStudentCache();
  try {
    await upsertDirectoryEntry(student);
  } catch (e) {
    // Không nuốt lỗi im lặng — thử rebuild để search không lệch identity
    console.error("upsertDirectoryEntry failed, rebuilding directory", e);
    await rebuildStudentDirectory();
  }
}

/** Ghi nhiều SV trong batch (tối đa 400 / lần) để giảm round-trip & đỡ cháy quota. */
export async function upsertStudentsBatch(students: Student[]) {
  if (!students.length) return;
  const db = getDb();
  const now = new Date().toISOString();
  const CHUNK = 400;
  for (let i = 0; i < students.length; i += CHUNK) {
    const chunk = students.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const student of chunk) {
      const searchMeta = buildSearchMeta(student);
      const payload = stripUndefined({
        ...student,
        ...searchMeta,
        maSinhVien: student.maSinhVien,
        hoVaTen: student.hoVaTen || "",
        documents: student.documents || emptyDocuments(),
        updatedAt: now,
        createdAt: student.createdAt || now,
      });
      batch.set(db.collection("students").doc(student.maSinhVien), payload, {
        merge: true,
      });
    }
    await batch.commit();
  }
  invalidateStudentCache();
  // Rebuild directory 1 lần sau import — tránh N lần read-modify-write
  try {
    await rebuildStudentDirectory();
  } catch (e) {
    console.error("rebuildStudentDirectory after batch failed", e);
    throw e;
  }
}

export async function studentExists(maSinhVien: string) {
  const db = getDb();
  const doc = await db.collection("students").doc(maSinhVien).get();
  return doc.exists;
}

export async function getChangeRequest(
  maSinhVien: string
): Promise<ChangeRequest | null> {
  const db = getDb();
  const doc = await db.collection("changeRequests").doc(maSinhVien).get();
  if (!doc.exists) return null;
  return doc.data() as ChangeRequest;
}

export async function saveChangeRequest(request: ChangeRequest) {
  const db = getDb();
  await db
    .collection("changeRequests")
    .doc(request.maSinhVien)
    .set(stripUndefined(request));
}

export async function deleteChangeRequest(maSinhVien: string) {
  const db = getDb();
  await db.collection("changeRequests").doc(maSinhVien).delete();
}

export async function listPendingRequests(): Promise<ChangeRequest[]> {
  const db = getDb();
  const snap = await db
    .collection("changeRequests")
    .where("status", "==", "pending")
    .get();
  return snap.docs.map((d) => d.data() as ChangeRequest);
}

/** Danh sách nhẹ từ directory (1 read) — đủ cho bảng admin. */
export async function listStudents(limit = 200): Promise<Student[]> {
  const entries = await getDirectoryEntries();
  return entries.slice(0, limit).map(entryToStudentStub);
}

export async function searchStudentsAdmin(query: string): Promise<Student[]> {
  if (!query.trim()) return listStudents(5000);
  return findStudentsByQuery(query, 100);
}
