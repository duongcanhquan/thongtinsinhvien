import { getDb } from "@/lib/firebase-admin";
import {
  DOCUMENT_KEYS,
  cellToString,
  inferDocumentStatus,
  normalizeCccd,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeText,
} from "@/lib/student-fields";
import type {
  ChangeRequest,
  DocumentSlot,
  Student,
  StudentIdentity,
} from "@/lib/types";

function emptyDocuments(): Record<string, DocumentSlot> {
  const docs: Record<string, DocumentSlot> = {};
  for (const key of DOCUMENT_KEYS) {
    docs[key] = { status: "thieu", files: [] };
  }
  return docs;
}

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
  fields: Record<string, string>
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
      const slot: DocumentSlot = {
        status: inferDocumentStatus(value),
        files: [],
      };
      if (value) slot.note = value;
      documents[key] = slot;
      continue;
    }

    // Always store string (never undefined) for scalar fields
    student[key] = value;
  }

  student.documents = documents;
  return stripUndefined(student as Student);
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

export async function findStudentsByQuery(
  query: string,
  limit = 8
): Promise<Student[]> {
  const q = normalizeText(query);
  if (!q) return [];

  const db = getDb();
  const snap = await db.collection("students").get();
  const phoneQ = normalizePhone(q);
  const emailQ = normalizeEmail(q);
  const cccdQ = normalizeCccd(q);
  const nameQ = normalizeName(q);
  const idQ = normalizeText(q).toLowerCase();

  const matches: Student[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Student;
    const ma = normalizeText(data.maSinhVien || doc.id).toLowerCase();
    const phone = normalizePhone(data.soDienThoai);
    const email = normalizeEmail(data.emailCaNhan);
    const cccd = normalizeCccd(data.canCuoc);
    const name = normalizeName(data.hoVaTen);

    const hit =
      (nameQ.length >= 2 && name.includes(nameQ)) ||
      (phoneQ.length >= 3 && phone.includes(phoneQ)) ||
      (cccdQ.length >= 3 && cccd.includes(cccdQ)) ||
      (emailQ.length >= 3 && email.includes(emailQ)) ||
      (idQ.length >= 3 && ma.includes(idQ));

    if (hit) {
      matches.push({ ...data, maSinhVien: data.maSinhVien || doc.id });
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

/** Merge Excel document slots into existing ones — keep uploaded files. */
export function mergeDocumentSlots(
  existing: Record<string, DocumentSlot> | undefined,
  incoming: Record<string, DocumentSlot> | undefined
): Record<string, DocumentSlot> {
  const base = emptyDocuments();
  const prev = existing || {};
  const next = incoming || {};

  for (const key of DOCUMENT_KEYS) {
    const oldSlot = prev[key];
    const newSlot = next[key];
    if (!oldSlot && !newSlot) {
      base[key] = { status: "thieu", files: [] };
      continue;
    }
    const files = oldSlot?.files?.length
      ? oldSlot.files
      : newSlot?.files || [];
    const status = newSlot?.status || oldSlot?.status || "thieu";
    const note = newSlot?.note ?? oldSlot?.note;
    const slot: DocumentSlot = { status, files };
    if (note) slot.note = note;
    base[key] = slot;
  }

  return base;
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

/** Load every student document (admin / export). No artificial cap. */
export async function listStudents(): Promise<Student[]> {
  const db = getDb();
  const snap = await db.collection("students").get();
  return snap.docs.map((d) => ({ ...(d.data() as Student), maSinhVien: d.id }));
}

export async function searchStudentsAdmin(query: string): Promise<Student[]> {
  if (!query.trim()) return listStudents();
  // Admin needs full match set, not the public suggest limit of 8
  return findStudentsByQuery(query, Number.POSITIVE_INFINITY);
}
