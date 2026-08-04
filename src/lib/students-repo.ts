import { getDb } from "@/lib/firebase-admin";
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
  getCachedStudents,
  invalidateStudentCache,
  isQuotaExceededError,
  quotaExceededMessage,
} from "@/lib/student-cache";
import type {
  ChangeRequest,
  DocumentSlot,
  Student,
  StudentIdentity,
} from "@/lib/types";

export {
  invalidateStudentCache,
  isQuotaExceededError,
  quotaExceededMessage,
};

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

/** Upsert from Excel: overwrite scalar fields, keep uploaded files + Drive links. */
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

function matchStudent(data: Student, docId: string, q: string): boolean {
  const phoneQ = normalizePhone(q);
  const emailQ = normalizeEmail(q);
  const cccdQ = normalizeCccd(q);
  const nameQ = normalizeName(q);
  const idQ = normalizeText(q).toLowerCase();

  const ma = normalizeText(data.maSinhVien || docId).toLowerCase();
  const phone = normalizePhone(data.soDienThoai);
  const email = normalizeEmail(data.emailCaNhan);
  const cccd = normalizeCccd(data.canCuoc);
  const name = normalizeName(data.hoVaTen);

  return (
    (nameQ.length >= 2 && name.includes(nameQ)) ||
    (phoneQ.length >= 3 && phone.includes(phoneQ)) ||
    (cccdQ.length >= 3 && cccd.includes(cccdQ)) ||
    (emailQ.length >= 3 && email.includes(emailQ)) ||
    (idQ.length >= 3 && ma.includes(idQ))
  );
}

/**
 * Search students. Uses in-memory cache to avoid a full Firestore collection
 * read on every keystroke (was exhausting daily read quota).
 */
export async function findStudentsByQuery(
  query: string,
  limit = 8
): Promise<Student[]> {
  const q = normalizeText(query);
  if (!q) return [];

  // Fast path: exact mã SV → 1 document read, no collection scan
  const maybeId = normalizeText(q);
  if (/^\d{8,}$/.test(maybeId)) {
    const exact = await getStudent(maybeId);
    if (exact) return [exact];
  }

  const all = await getCachedStudents();
  const matches: Student[] = [];
  for (const data of all) {
    if (matchStudent(data, data.maSinhVien, q)) {
      matches.push(data);
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

export async function getStudent(maSinhVien: string): Promise<Student | null> {
  const db = getDb();
  const doc = await db.collection("students").doc(maSinhVien).get();
  if (!doc.exists) return null;
  return { ...(doc.data() as Student), maSinhVien: doc.id };
}

export async function upsertStudent(student: Student) {
  const db = getDb();
  const now = new Date().toISOString();
  const payload = stripUndefined({
    ...student,
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

export async function listStudents(limit = 200): Promise<Student[]> {
  // Prefer cache so admin list / export do not re-scan when warm
  const all = await getCachedStudents();
  return all.slice(0, limit);
}

export async function searchStudentsAdmin(query: string): Promise<Student[]> {
  if (!query.trim()) return listStudents(5000);
  return findStudentsByQuery(query, 100);
}
