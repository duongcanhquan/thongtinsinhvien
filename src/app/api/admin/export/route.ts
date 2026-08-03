import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminSession } from "@/lib/session";
import {
  DOCUMENT_KEYS,
  EXCEL_HEADER_ORDER,
  cellToString,
} from "@/lib/student-fields";
import { listStudents } from "@/lib/students-repo";
import type { Student } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Export all students (raise limit for school-scale datasets)
    const students = await listStudents(5000);
    students.sort((a, b) =>
      String(a.maSinhVien).localeCompare(String(b.maSinhVien), "vi")
    );

    const headers = EXCEL_HEADER_ORDER.map((h) => h.label);
    const englishRow = headers.map(() => "");
    const rows: (string | number)[][] = [englishRow, headers];

    students.forEach((student, index) => {
      rows.push(studentToExcelRow(student, index + 1));
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "SINH VIEN");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sinh-vien-export.xlsx"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function studentToExcelRow(student: Student, stt: number): (string | number)[] {
  return EXCEL_HEADER_ORDER.map(({ key }) => {
    if (key === "stt") return student.stt ?? stt;
    if (key === "maSinhVien") return student.maSinhVien || "";
    if (DOCUMENT_KEYS.has(key)) {
      const slot = student.documents?.[key];
      if (!slot) return "";
      if (slot.files?.length) {
        return `Có file (${slot.files.map((f) => f.name).join("; ")})`;
      }
      if (slot.note) return slot.note;
      if (slot.status === "du") return "Đủ";
      if (slot.status === "thieu") return "Thiếu";
      return "";
    }
    return cellToString((student as Record<string, unknown>)[key]);
  });
}
