import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminSession } from "@/lib/session";
import {
  DOCUMENT_KEYS,
  EXCEL_COLUMN_MAP,
  cellToString,
  extractHttpUrl,
} from "@/lib/student-fields";
import {
  getStudent,
  studentExists,
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

    const headerRow = pickHeaderRow(rows);
    const colKeys = headerRow.map((h) => {
      const label = cellToString(h);
      return EXCEL_COLUMN_MAP[label] || null;
    });

    let added = 0;
    let skipped = 0;
    let linksUpdated = 0;
    const errors: string[] = [];

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => cellToString(c) === "")) continue;

      const fields: Record<string, string> = {};
      const externalUrls: Record<string, string> = {};

      colKeys.forEach((key, idx) => {
        if (!key) return;
        fields[key] = cellToString(row[idx]);
        if (!DOCUMENT_KEYS.has(key)) return;
        const href = cellHyperlink(sheet, r, idx);
        if (href) externalUrls[key] = href;
      });

      const student = studentFromFields(fields, externalUrls);
      if (!student) {
        errors.push(`Dòng ${r + 1}: thiếu mã sinh viên`);
        continue;
      }

      if (await studentExists(student.maSinhVien)) {
        skipped += 1;
        // Cập nhật link Drive cho mọi cột giấy tờ có hyperlink (không ghi đè field khác)
        const existing = await getStudent(student.maSinhVien);
        if (existing) {
          let changed = false;
          const nextDocs = { ...(existing.documents || {}) };
          for (const key of DOCUMENT_KEYS) {
            const incoming = student.documents?.[key];
            const photoUrl = extractHttpUrl(incoming?.externalUrl);
            if (!photoUrl) continue;
            const prev = nextDocs[key] || {
              status: "thieu" as const,
              files: [],
            };
            if (prev.externalUrl === photoUrl) continue;
            const note =
              cellToString(incoming?.note) || cellToString(prev.note);
            nextDocs[key] = {
              ...prev,
              status: prev.status === "thieu" ? "du" : prev.status,
              externalUrl: photoUrl,
              ...(note ? { note } : {}),
              files: prev.files || [],
            };
            changed = true;
          }
          if (changed) {
            existing.documents = nextDocs;
            existing.updatedAt = new Date().toISOString();
            await upsertStudent(existing);
            linksUpdated += 1;
          }
        }
        continue;
      }

      const now = new Date().toISOString();
      student.importedAt = now;
      student.createdAt = now;
      student.updatedAt = now;
      await upsertStudent(student);
      added += 1;
    }

    return NextResponse.json({
      ok: true,
      added,
      skipped,
      linksUpdated,
      errors,
    });
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

/** Đọc hyperlink Excel (vd. Drive) tại dòng/cột 0-based. */
function cellHyperlink(
  sheet: XLSX.WorkSheet,
  rowIndex: number,
  colIndex: number
): string {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = sheet[addr] as XLSX.CellObject | undefined;
  if (!cell?.l) return "";
  const target =
    typeof cell.l === "object" && cell.l && "Target" in cell.l
      ? String((cell.l as { Target?: string }).Target || "")
      : "";
  return extractHttpUrl(target);
}
