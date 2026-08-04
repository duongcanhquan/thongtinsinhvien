import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminSession } from "@/lib/session";
import {
  DOCUMENT_KEYS,
  EXCEL_EXPORT_LAYOUT,
  EXCEL_SHEET_NAME,
  cellToString,
  documentSlotToExcel,
  extractHttpUrl,
} from "@/lib/student-fields";
import {
  isQuotaExceededError,
  listStudents,
  quotaExceededMessage,
} from "@/lib/students-repo";
import type { Student } from "@/lib/types";

export const runtime = "nodejs";

/** Phone / ID fields must stay text so leading zeros are preserved. */
const TEXT_KEYS = new Set([
  "maSinhVien",
  "soDienThoai",
  "canCuoc",
  "sdtCha",
  "sdtMe",
  "sdtNguoiGiamHo",
  "emailTruong",
  "emailCaNhan",
]);

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const students = await listStudents(5000);
    students.sort((a, b) => {
      const sa = Number(a.stt);
      const sb = Number(b.stt);
      if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
      return String(a.maSinhVien).localeCompare(String(b.maSinhVien), "vi");
    });

    const englishRow = EXCEL_EXPORT_LAYOUT.map((c) => c.en);
    const vietnameseRow = EXCEL_EXPORT_LAYOUT.map((c) => c.vi);
    const rows: (string | number)[][] = [englishRow, vietnameseRow];

    students.forEach((student, index) => {
      rows.push(studentToExcelRow(student, index + 1));
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const lastCol = colLetter(EXCEL_EXPORT_LAYOUT.length - 1);
    const lastRow = rows.length; // 1-based inclusive

    // Match original workbook shape: filter over data block under header row 2
    if (students.length > 0) {
      sheet["!autofilter"] = { ref: `A3:${lastCol}${lastRow}` };
    }
    sheet["!margins"] = {
      left: 0.75,
      right: 0.75,
      top: 1,
      bottom: 1,
      header: 0.5,
      footer: 0.5,
    };
    sheet["!cols"] = EXCEL_EXPORT_LAYOUT.map((c) => ({
      wch: suggestColWidth(c.en, c.vi, c.key),
    }));
    sheet["!rows"] = [{ hpt: 18 }, { hpt: 32 }];

    // Force text for phone / ID columns (preserve leading zeros)
    // + gắn lại hyperlink Drive cho cột ẢNH / giấy tờ có externalUrl
    for (let r = 2; r < rows.length; r++) {
      const student = students[r - 2];
      EXCEL_EXPORT_LAYOUT.forEach((col, c) => {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (col.key && TEXT_KEYS.has(col.key)) {
          if (!cell || cell.v === "" || cell.v == null) return;
          cell.t = "s";
          cell.v = String(cell.v);
        }
        if (col.key && DOCUMENT_KEYS.has(col.key) && student) {
          const url = extractHttpUrl(student.documents?.[col.key]?.externalUrl);
          if (!url) return;
          const display =
            cellToString(student.documents?.[col.key]?.note) ||
            cellToString(cell?.v) ||
            "PHOTO";
          sheet[addr] = {
            t: "s",
            v: display,
            l: { Target: url, Tooltip: url },
          };
        }
      });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, EXCEL_SHEET_NAME);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SINH VIEN export.xlsx"`,
      },
    });
  } catch (e) {
    if (isQuotaExceededError(e)) {
      return NextResponse.json(
        { error: quotaExceededMessage() },
        { status: 503 }
      );
    }
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function studentToExcelRow(student: Student, fallbackStt: number): (string | number)[] {
  return EXCEL_EXPORT_LAYOUT.map(({ key }) => {
    if (!key) return "";
    if (key === "stt") {
      const raw = cellToString(student.stt);
      if (raw && /^\d+$/.test(raw)) return Number(raw);
      return fallbackStt;
    }
    if (DOCUMENT_KEYS.has(key)) {
      return documentSlotToExcel(student.documents?.[key]);
    }
    const value = cellToString((student as Record<string, unknown>)[key]);
    if (key === "maSinhVien" && /^\d+$/.test(value)) {
      // Keep as string in TEXT_KEYS pass; store string here for leading-zero safety
      return value;
    }
    return value;
  });
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function suggestColWidth(en: string, vi: string, key: string | null): number {
  if (!key) return 3;
  const label = Math.max(en.length, vi.trim().length);
  if (
    key === "diaChiThuongTru" ||
    key === "diaChiTamTru" ||
    key === "hoVaTen" ||
    key === "emailCaNhan" ||
    key === "emailTruong"
  ) {
    return Math.min(Math.max(label + 4, 22), 40);
  }
  if (DOCUMENT_KEYS.has(key)) {
    return Math.min(Math.max(label + 2, 12), 28);
  }
  return Math.min(Math.max(label + 2, 8), 24);
}
