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
  mergeStudentFromImport,
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

    // Dòng 1–2: tiêu đề (ưu tiên dòng 2 tiếng Việt). Dòng 3+ (index 2): dữ liệu SV
    const headerRow = pickHeaderRow(rows);
    const colKeys = headerRow.map((h) => {
      const label = cellToString(h);
      return EXCEL_COLUMN_MAP[label] || null;
    });

    if (colKeys.filter(Boolean).length < 3) {
      return NextResponse.json(
        {
          error:
            "Không nhận diện được tiêu đề cột (cần dòng 2 tiếng Việt: STT, Họ và tên, Mã sinh viên, …)",
        },
        { status: 400 }
      );
    }

    let added = 0;
    let updated = 0;
    const errors: string[] = [];

    // Excel row 3 = index 2
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

      const incoming = studentFromFields(fields, externalUrls);
      if (!incoming) {
        errors.push(`Dòng ${r + 1}: thiếu mã sinh viên`);
        continue;
      }

      const existing = await getStudent(incoming.maSinhVien);
      const now = new Date().toISOString();

      if (existing) {
        const merged = mergeStudentFromImport(existing, incoming);
        await upsertStudent(merged);
        updated += 1;
        continue;
      }

      incoming.importedAt = now;
      incoming.createdAt = now;
      incoming.updatedAt = now;
      await upsertStudent(incoming);
      added += 1;
    }

    return NextResponse.json({
      ok: true,
      added,
      updated,
      skipped: 0,
      linksUpdated: 0,
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
  // Ưu tiên dòng 2 (index 1) — tiêu đề tiếng Việt chuẩn file K26
  const row2 = rows[1] || [];
  const hits2 = row2
    .map((c) => cellToString(c))
    .filter((l) => l in EXCEL_COLUMN_MAP).length;
  if (hits2 >= 3) return row2;

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
