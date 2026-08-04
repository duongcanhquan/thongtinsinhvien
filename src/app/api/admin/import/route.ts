import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminSession } from "@/lib/session";
import {
  DOCUMENT_KEYS,
  EXCEL_EXPORT_LAYOUT,
  cellToString,
  extractHttpUrl,
  resolveExcelColumnKey,
} from "@/lib/student-fields";
import {
  firestoreUserMessage,
  getCachedStudents,
  isQuotaExceededError,
  mergeStudentFromImport,
  quotaExceededMessage,
  studentFromFields,
  upsertStudentsBatch,
} from "@/lib/students-repo";
import type { Student } from "@/lib/types";

export const runtime = "nodejs";

/** Dòng dữ liệu SV bắt đầu (Excel row 3 = index 2). */
const DATA_START_ROW = 2;

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
      blankrows: true,
    });

    if (rows.length <= DATA_START_ROW) {
      return NextResponse.json(
        {
          error:
            "File cần ít nhất 3 dòng: dòng 1–2 tiêu đề, từ dòng 3 là dữ liệu sinh viên",
        },
        { status: 400 }
      );
    }

    const colKeys = buildColumnKeys(rows);
    if (!colKeys.includes("maSinhVien")) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy cột Mã sinh viên. Kiểm tra file đúng khuôn (dòng 2 có «Mã sinh viên» hoặc đúng thứ tự cột file K26).",
        },
        { status: 400 }
      );
    }

    let added = 0;
    let updated = 0;
    const errors: string[] = [];
    const toWrite: Student[] = [];

    // 1 lần đọc (hoặc cache) thay vì getStudent từng dòng — tránh đốt read quota
    const existingById = new Map(
      (await getCachedStudents()).map((s) => [s.maSinhVien, s])
    );

    for (let r = DATA_START_ROW; r < rows.length; r++) {
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

      const existing = existingById.get(incoming.maSinhVien);
      const now = new Date().toISOString();

      if (existing) {
        toWrite.push(mergeStudentFromImport(existing, incoming));
        updated += 1;
      } else {
        incoming.importedAt = now;
        incoming.createdAt = now;
        incoming.updatedAt = now;
        toWrite.push(incoming);
        added += 1;
      }
    }

    // Ghi batch để giảm số round-trip / đỡ cháy write quota
    await upsertStudentsBatch(toWrite);

    return NextResponse.json({
      ok: true,
      added,
      updated,
      skipped: 0,
      linksUpdated: 0,
      errors,
    });
  } catch (e) {
    if (isQuotaExceededError(e)) {
      return NextResponse.json(
        { error: quotaExceededMessage() },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: firestoreUserMessage(e) }, { status: 500 });
  }
}

function buildColumnKeys(
  rows: (string | number | Date | null)[][]
): (string | null)[] {
  const headerRow = pickHeaderRow(rows);
  const mapped = headerRow.map((h) => resolveExcelColumnKey(h));
  const hits = mapped.filter(Boolean).length;
  const hasMaSv = mapped.includes("maSinhVien");

  if (hits >= 3 && hasMaSv) {
    return mapped;
  }

  return EXCEL_EXPORT_LAYOUT.map((c) => c.key);
}

function pickHeaderRow(
  rows: (string | number | Date | null)[][]
): (string | number | Date | null)[] {
  const candidates = [rows[1], rows[0], rows[2]].filter(Boolean) as (
    | (string | number | Date | null)[]
  )[];

  let best = candidates[0] || [];
  let bestHits = 0;
  for (const row of candidates) {
    const hits = row.map((c) => resolveExcelColumnKey(c)).filter(Boolean).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = row;
    }
  }
  return best;
}

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
