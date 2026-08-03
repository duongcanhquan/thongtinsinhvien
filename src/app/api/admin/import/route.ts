import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminSession } from "@/lib/session";
import {
  EXCEL_COLUMN_MAP,
  cellToString,
} from "@/lib/student-fields";
import {
  getStudent,
  mergeDocumentSlots,
  studentFromFields,
  upsertStudent,
} from "@/lib/students-repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file Excel" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "File không có sheet" }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    // header: 1 → array of arrays; data starts at Excel row 3 → index 2
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (rows.length < 3) {
      return NextResponse.json(
        { error: "File cần ít nhất 3 dòng (2 dòng thông tin + dữ liệu)" },
        { status: 400 }
      );
    }

    // Use row 2 (index 1) or row 1 as header if it looks like headers; prefer first non-empty header row among first 2
    const headerRow = pickHeaderRow(rows);
    const headerIndex = rows.indexOf(headerRow);
    const colKeys = headerRow.map((h) => {
      const label = cellToString(h);
      return EXCEL_COLUMN_MAP[label] || null;
    });

    let added = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let r = 2; r < rows.length; r++) {
      // Always start data at Excel row 3 (index 2), even if header detection differed
      const row = rows[r];
      if (!row || row.every((c) => cellToString(c) === "")) continue;

      const fields: Record<string, string> = {};
      colKeys.forEach((key, idx) => {
        if (!key) return;
        fields[key] = cellToString(row[idx]);
      });

      const student = studentFromFields(fields);
      if (!student) {
        errors.push(`Dòng ${r + 1}: thiếu mã sinh viên`);
        continue;
      }

      const now = new Date().toISOString();
      const existing = await getStudent(student.maSinhVien);

      if (existing) {
        // Refresh scalar fields from Excel; keep uploaded files on document slots
        const merged = {
          ...existing,
          ...student,
          documents: mergeDocumentSlots(existing.documents, student.documents),
          createdAt: existing.createdAt || now,
          importedAt: existing.importedAt || now,
          updatedAt: now,
        };
        await upsertStudent(merged);
        updated += 1;
        continue;
      }

      student.importedAt = now;
      student.createdAt = now;
      student.updatedAt = now;
      await upsertStudent(student);
      added += 1;
    }

    void headerIndex;
    return NextResponse.json({ ok: true, added, updated, skipped: 0, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function pickHeaderRow(
  rows: (string | number | Date | null)[][]
): (string | number | Date | null)[] {
  for (const row of rows.slice(0, 2)) {
    const labels = row.map((c) => cellToString(c));
    const hits = labels.filter((l) => l in EXCEL_COLUMN_MAP).length;
    if (hits >= 3) return row;
  }
  return rows[1] || rows[0] || [];
}
