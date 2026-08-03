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

export function studentFromFields(
  fields: Record<string, string>
): Student | null {
  const maSinhVien = cellToString(fields.maSinhVien);
  if (!maSinhVien) return null;

  const documents = emptyDocuments();
  const student: Student = {
    maSinhVien,
    hoVaTen: cellToString(fields.hoVaTen),
    documents,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (key === "maSinhVien" || key === "hoVaTen") continue;
    if (DOCUMENT_KEYS.has(key)) {
      documents[key] = {
        status: inferDocumentStatus(value),
        files: [],
        note: value || undefined,
      };
      continue;
    }
    (student as Record<string, unknown>)[key] = value;
  }

  student.documents = documents;
  return student;
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

export async function findStudentsByQuery(query: string): Promise<Student[]> {
  const q = normalizeText(query);
  if (!q) return [];

  const db = getDb();
  const snap = await db.collection("students").get();
  const phoneQ = normalizePhone(q);
  const emailQ = normalizeEmail(q);
  const cccdQ = normalizeCccd(q);
  const nameQ = normalizeName(q);

  const matches: Student[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Student;
    const phone = normalizePhone(data.soDienThoai);
    const email = normalizeEmail(data.emailCaNhan);
    const cccd = normalizeCccd(data.canCuoc);
    const name = normalizeName(data.hoVaTen);

    const hit =
      (phoneQ.length >= 8 && phone === phoneQ) ||
      (emailQ.includes("@") && email === emailQ) ||
      (cccdQ.length >= 8 && cccd === cccdQ) ||
      (nameQ.length >= 3 && (name === nameQ || name.includes(nameQ)));

    if (hit) matches.push({ ...data, maSinhVien: data.maSinhVien || doc.id });
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
  await db
    .collection("students")
    .doc(student.maSinhVien)
    .set(
      {
        ...student,
        updatedAt: now,
        createdAt: student.createdAt || now,
      },
      { merge: true }
    );
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
  await db.collection("changeRequests").doc(request.maSinhVien).set(request);
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
  const db = getDb();
  const snap = await db.collection("students").limit(limit).get();
  return snap.docs.map((d) => ({ ...(d.data() as Student), maSinhVien: d.id }));
}

export async function searchStudentsAdmin(query: string): Promise<Student[]> {
  if (!query.trim()) return listStudents();
  return findStudentsByQuery(query);
}
