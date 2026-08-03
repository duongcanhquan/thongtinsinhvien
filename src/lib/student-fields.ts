/**
 * Excel column headers (row may vary) → Student field keys.
 * Import reads data starting at Excel row index 2 (1-based row 3).
 */
export const EXCEL_COLUMN_MAP: Record<string, string> = {
  STT: "stt",
  "Họ và tên": "hoVaTen",
  "Họ và": "hoVa",
  Tên: "ten",
  "Mã sinh viên": "maSinhVien",
  "Giới tính": "gioiTinh",
  "Ngày sinh": "ngaySinh",
  Ngày: "ngay",
  Tháng: "thang",
  Năm: "nam",
  "Số điện thoại": "soDienThoai",
  "Email trường": "emailTruong",
  "Email cá nhân": "emailCaNhan",
  "Khu vực": "khuVuc",
  "Địa chỉ thường trú": "diaChiThuongTru",
  "Địa chỉ tạm trú/hiện tại": "diaChiTamTru",
  "Hệ đào tạo": "heDaoTao",
  "Khoa đào tạo": "khoaDaoTao",
  Ngành: "nganh",
  Lớp: "lop",
  "Lớp chủ nhiệm tháng 8 và tháng 9": "lopChuNhiemThang89",
  "Ghi chú xếp lớp": "ghiChuXepLop",
  "SV đã có laptop": "svDaCoLaptop",
  "Xếp lớp tin học": "xepLopTinHoc",
  "Khóa ban đầu": "khoaBanDau",
  "Khóa hiện tại": "khoaHienTai",
  "Nơi sinh": "noiSinh",
  "Dân tộc": "danToc",
  "Căn cước": "canCuoc",
  "Ngày nhập học": "ngayNhapHoc",
  "Tư vấn tuyển sinh": "tuVanTuyenSinh",
  "Cơ sở học": "coSoHoc",
  "Họ tên cha": "hoTenCha",
  "Sđt cha": "sdtCha",
  "Họ tên mẹ": "hoTenMe",
  "Sđt mẹ": "sdtMe",
  "Người giám hộ": "nguoiGiamHo",
  "Sđt người giám hộ": "sdtNguoiGiamHo",
  "Trường THPT": "truongThpt",
  "Tỉnh trường": "tinhTruong",
  "Đối tượng": "doiTuong",
  "Điểm trung bình": "diemTrungBinh",
  "Học bổng": "hocBong",
  "Thông tin sai lệch": "thongTinSaiLech",
  "Máy tính học tập": "mayTinhHocTap",
  "Ghi chú hồ sơ": "ghiChuHoSo",
  // Document status columns
  ẢNH: "anh",
  "Phiếu đăng ký dự tuyển": "phieuDangKyDuTuyen",
  "Tờ khai sinh viên": "toKhaiSinhVien",
  CCCD: "cccdFile",
  "Giấy khai sinh": "giayKhaiSinh",
  "Chứng nhận hoàn thành THPT": "chungNhanHoanThanhThpt",
  "Chứng nhận TN/kết quả thi THPT": "chungNhanTnKetQuaThiThpt",
  "Bằng THPT": "bangThpt",
  "Học bạ THPT": "hocBaThpt",
  "Bằng THCS": "bangThcs",
  "Học bạ THCS": "hocBaThcs",
  "Thông tin cư trú": "thongTinCuTru",
  "Giấy khám sức khỏe": "giayKhamSucKhoe",
  "Ảnh thẻ": "anhThe",
};

export const DOCUMENT_KEYS = new Set([
  "anh",
  "phieuDangKyDuTuyen",
  "toKhaiSinhVien",
  "cccdFile",
  "giayKhaiSinh",
  "chungNhanHoanThanhThpt",
  "chungNhanTnKetQuaThiThpt",
  "bangThpt",
  "hocBaThpt",
  "bangThcs",
  "hocBaThcs",
  "thongTinCuTru",
  "giayKhamSucKhoe",
  "anhThe",
]);

export const DOCUMENT_LABELS: Record<string, string> = {
  anh: "ẢNH",
  phieuDangKyDuTuyen: "Phiếu đăng ký dự tuyển",
  toKhaiSinhVien: "Tờ khai sinh viên",
  cccdFile: "CCCD",
  giayKhaiSinh: "Giấy khai sinh",
  chungNhanHoanThanhThpt: "Chứng nhận hoàn thành THPT",
  chungNhanTnKetQuaThiThpt: "Chứng nhận TN/kết quả thi THPT",
  bangThpt: "Bằng THPT",
  hocBaThpt: "Học bạ THPT",
  bangThcs: "Bằng THCS",
  hocBaThcs: "Học bạ THCS",
  thongTinCuTru: "Thông tin cư trú",
  giayKhamSucKhoe: "Giấy khám sức khỏe",
  anhThe: "Ảnh thẻ",
};

/** Sinh viên chỉ được upload ảnh; giấy tờ khác nộp bản cứng cho GVCN. */
export const STUDENT_UPLOADABLE_DOCUMENT_KEYS = new Set(["anh", "anhThe"]);

export function isStudentUploadableDocument(key: string) {
  return STUDENT_UPLOADABLE_DOCUMENT_KEYS.has(key);
}

/**
 * Exact export layout from `SINH VIÊN K26.xlsx` (sheet CAO ĐẲNG).
 * Row 1 = English, Row 2 = Vietnamese. Includes spacer columns (key null).
 * Data starts at Excel row 3.
 */
export const EXCEL_EXPORT_LAYOUT: {
  en: string;
  vi: string;
  key: string | null;
}[] = [
  { en: "No.", vi: "STT", key: "stt" },
  { en: "Full Name", vi: "Họ và tên", key: "hoVaTen" },
  { en: "", vi: "Họ và", key: "hoVa" },
  { en: "Name", vi: "Tên", key: "ten" },
  { en: "Student ID", vi: "Mã sinh viên", key: "maSinhVien" },
  { en: "Gender", vi: "Giới tính", key: "gioiTinh" },
  { en: "Date of Birth", vi: "Ngày sinh", key: "ngaySinh" },
  { en: "Day", vi: "Ngày", key: "ngay" },
  { en: "Month", vi: "Tháng", key: "thang" },
  { en: "Year", vi: "Năm", key: "nam" },
  { en: "Phone Number", vi: "Số điện thoại", key: "soDienThoai" },
  { en: "University Email", vi: "Email trường", key: "emailTruong" },
  { en: "Personal Email", vi: "Email cá nhân", key: "emailCaNhan" },
  { en: "Region", vi: "Khu vực", key: "khuVuc" },
  { en: "Permanent Address", vi: "Địa chỉ thường trú", key: "diaChiThuongTru" },
  { en: "Current Address", vi: "Địa chỉ tạm trú/hiện tại", key: "diaChiTamTru" },
  { en: "Training Program", vi: "Hệ đào tạo", key: "heDaoTao" },
  { en: "Faculty", vi: "Khoa đào tạo", key: "khoaDaoTao" },
  { en: "Major", vi: "Ngành", key: "nganh" },
  { en: "Name", vi: "Lớp", key: "lop" },
  { en: "", vi: "Lớp chủ nhiệm tháng 8 và tháng 9", key: "lopChuNhiemThang89" },
  { en: "", vi: "Ghi chú xếp lớp", key: "ghiChuXepLop" },
  { en: "", vi: "SV đã có laptop", key: "svDaCoLaptop" },
  { en: "", vi: "Xếp lớp tin học", key: "xepLopTinHoc" },
  { en: "Admission Cohort", vi: "Khóa ban đầu", key: "khoaBanDau" },
  { en: "Current Cohort", vi: "Khóa hiện tại", key: "khoaHienTai" },
  { en: "Place of Birth", vi: "Nơi sinh", key: "noiSinh" },
  { en: "Ethnicity", vi: "Dân tộc", key: "danToc" },
  { en: "ID Card", vi: "Căn cước", key: "canCuoc" },
  { en: "Enrollment Date", vi: "Ngày nhập học", key: "ngayNhapHoc" },
  { en: "Admissions Counseling", vi: "Tư vấn tuyển sinh", key: "tuVanTuyenSinh" },
  { en: "Campus", vi: "Cơ sở học", key: "coSoHoc" },
  { en: "Father's Full Name", vi: "Họ tên cha", key: "hoTenCha" },
  { en: "Father's Phone Number", vi: "Sđt cha", key: "sdtCha" },
  { en: "Mother's Full Name", vi: "Họ tên mẹ", key: "hoTenMe" },
  { en: "Mother's Phone Number", vi: "Sđt mẹ", key: "sdtMe" },
  { en: "Guardian", vi: "Người giám hộ", key: "nguoiGiamHo" },
  { en: "Guardian's Phone Number", vi: "Sđt người giám hộ", key: "sdtNguoiGiamHo" },
  { en: "High School", vi: "Trường THPT", key: "truongThpt" },
  { en: "High School Province", vi: "Tỉnh trường", key: "tinhTruong" },
  { en: "Priority Group", vi: "Đối tượng", key: "doiTuong" },
  { en: "Average Score", vi: "Điểm trung bình", key: "diemTrungBinh" },
  { en: "Scholarship", vi: "Học bổng", key: "hocBong" },
  { en: "PHOTO", vi: "ẢNH", key: "anh" },
  { en: "Incorrect Information", vi: "Thông tin sai lệch", key: "thongTinSaiLech" },
  { en: "Laptop", vi: "Máy tính học tập", key: "mayTinhHocTap" },
  { en: "", vi: "", key: null }, // spacer — giữ đúng khoảng cột file gốc
  { en: "", vi: "Ghi chú hồ sơ", key: "ghiChuHoSo" },
  { en: "", vi: "Phiếu đăng ký dự tuyển", key: "phieuDangKyDuTuyen" },
  { en: "", vi: "Tờ khai sinh viên", key: "toKhaiSinhVien" },
  { en: "", vi: "CCCD", key: "cccdFile" },
  { en: "", vi: "Giấy khai sinh ", key: "giayKhaiSinh" }, // trailing space như file gốc
  { en: "", vi: "Chứng nhận hoàn thành THPT", key: "chungNhanHoanThanhThpt" },
  { en: "", vi: "Chứng nhận TN/kết quả thi THPT", key: "chungNhanTnKetQuaThiThpt" },
  { en: "", vi: "Bằng THPT", key: "bangThpt" },
  { en: "", vi: "Học bạ THPT", key: "hocBaThpt" },
  { en: "", vi: "Bằng THCS", key: "bangThcs" },
  { en: "", vi: "Học bạ THCS", key: "hocBaThcs" },
  { en: "", vi: "Thông tin cư trú", key: "thongTinCuTru" },
  { en: "", vi: "Giấy khám sức khỏe", key: "giayKhamSucKhoe" },
  { en: "", vi: "Ảnh thẻ", key: "anhThe" },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
  { en: "", vi: "", key: null },
];

export const EXCEL_SHEET_NAME = "CAO ĐẲNG";

/** Ordered Excel columns (Vietnamese header → field key) for generic use. */
export const EXCEL_HEADER_ORDER: { label: string; key: string }[] =
  EXCEL_EXPORT_LAYOUT.filter(
    (c): c is { en: string; vi: string; key: string } => Boolean(c.key)
  ).map((c) => ({ label: c.vi.trim(), key: c.key }));

/** Excel document cell text matching import template (Đủ / trống / note gốc). */
export function documentSlotToExcel(
  slot:
    | {
        status?: string;
        note?: string;
        externalUrl?: string;
        files?: { name: string }[];
      }
    | undefined
): string {
  if (!slot) return "";
  const note = cellToString(slot.note);
  if (note) return note;
  if (slot.externalUrl) return cellToString(slot.externalUrl) || "PHOTO";
  if (slot.status === "du") return "Đủ";
  if (slot.status === "co_file") return "Có file";
  // "thieu" → để trống như file gốc (không ghi "Thiếu")
  return "";
}

/** Lấy URL http(s) từ text hoặc chuỗi chứa link. */
export function extractHttpUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return sanitizeExternalUrl(raw);
  const m = raw.match(/https?:\/\/[^\s<>"']+/i);
  return m ? sanitizeExternalUrl(m[0]) : "";
}

export function sanitizeExternalUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    // Chặn javascript: và scheme lạ
    return u.toString();
  } catch {
    return "";
  }
}

export function isExternalHttpUrl(value: unknown): boolean {
  return Boolean(extractHttpUrl(value));
}

/** Fields students may propose changing (everything except mã SV). */
export const STUDENT_EDITABLE_FIELDS = [
  "hoVaTen",
  "hoVa",
  "ten",
  "gioiTinh",
  "ngaySinh",
  "ngay",
  "thang",
  "nam",
  "soDienThoai",
  "emailTruong",
  "emailCaNhan",
  "khuVuc",
  "diaChiThuongTru",
  "diaChiTamTru",
  "heDaoTao",
  "khoaDaoTao",
  "nganh",
  "lop",
  "lopChuNhiemThang89",
  "ghiChuXepLop",
  "svDaCoLaptop",
  "xepLopTinHoc",
  "khoaBanDau",
  "khoaHienTai",
  "noiSinh",
  "danToc",
  "canCuoc",
  "ngayNhapHoc",
  "tuVanTuyenSinh",
  "coSoHoc",
  "hoTenCha",
  "sdtCha",
  "hoTenMe",
  "sdtMe",
  "nguoiGiamHo",
  "sdtNguoiGiamHo",
  "truongThpt",
  "tinhTruong",
  "doiTuong",
  "diemTrungBinh",
  "hocBong",
  "thongTinSaiLech",
  "mayTinhHocTap",
  "ghiChuHoSo",
] as const;

/** Admin form fields (mã SV shown separately as read-only). */
export const ADMIN_EDITABLE_FIELDS = ["stt", ...STUDENT_EDITABLE_FIELDS] as const;

export const FIELD_LABELS: Record<string, string> = {
  maSinhVien: "Mã sinh viên",
  stt: "STT",
  hoVaTen: "Họ và tên",
  hoVa: "Họ và",
  ten: "Tên",
  gioiTinh: "Giới tính",
  ngaySinh: "Ngày sinh",
  ngay: "Ngày",
  thang: "Tháng",
  nam: "Năm",
  soDienThoai: "Số điện thoại",
  emailTruong: "Email trường",
  emailCaNhan: "Email cá nhân",
  khuVuc: "Khu vực",
  diaChiThuongTru: "Địa chỉ thường trú",
  diaChiTamTru: "Địa chỉ tạm trú/hiện tại",
  heDaoTao: "Hệ đào tạo",
  khoaDaoTao: "Khoa đào tạo",
  nganh: "Ngành",
  lop: "Lớp",
  lopChuNhiemThang89: "Lớp chủ nhiệm tháng 8 và tháng 9",
  ghiChuXepLop: "Ghi chú xếp lớp",
  svDaCoLaptop: "SV đã có laptop",
  xepLopTinHoc: "Xếp lớp tin học",
  khoaBanDau: "Khóa ban đầu",
  khoaHienTai: "Khóa hiện tại",
  noiSinh: "Nơi sinh",
  danToc: "Dân tộc",
  canCuoc: "Căn cước",
  ngayNhapHoc: "Ngày nhập học",
  tuVanTuyenSinh: "Tư vấn tuyển sinh",
  coSoHoc: "Cơ sở học",
  hoTenCha: "Họ tên cha",
  sdtCha: "Sđt cha",
  hoTenMe: "Họ tên mẹ",
  sdtMe: "Sđt mẹ",
  nguoiGiamHo: "Người giám hộ",
  sdtNguoiGiamHo: "Sđt người giám hộ",
  truongThpt: "Trường THPT",
  tinhTruong: "Tỉnh trường",
  doiTuong: "Đối tượng",
  diemTrungBinh: "Điểm trung bình",
  hocBong: "Học bổng",
  thongTinSaiLech: "Thông tin sai lệch",
  mayTinhHocTap: "Máy tính học tập",
  ghiChuHoSo: "Ghi chú hồ sơ",
  ...DOCUMENT_LABELS,
};

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePhone(value: unknown): string {
  return normalizeText(value).replace(/[^\d+]/g, "");
}

/** Chỉ giữ tối đa 10 chữ số (SĐT Việt Nam). */
export function digitsPhone10(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 10);
}

/** Hợp lệ khi đủ đúng 10 số. Chuỗi rỗng = chưa điền (tuỳ ngữ cảnh). */
export function isValidPhone10(value: unknown): boolean {
  return /^\d{10}$/.test(digitsPhone10(value));
}

/**
 * Chuẩn hóa ngày sinh về DD/MM/YYYY nếu parse được.
 * Chấp nhận DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD.
 */
export function normalizeBirthDate(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) return "";

  let d = 0;
  let m = 0;
  let y = 0;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  } else {
    return raw;
  }

  if (!isRealCalendarDate(d, m, y)) return raw;
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

export function isValidBirthDate(value: unknown): boolean {
  const raw = normalizeText(value);
  if (!raw) return false;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return false;
  const [dd, mm, yyyy] = raw.split("/").map(Number);
  return isRealCalendarDate(dd, mm, yyyy);
}

export function birthPartsFromDate(value: unknown): {
  ngay: string;
  thang: string;
  nam: string;
} {
  const normalized = normalizeBirthDate(value);
  if (!isValidBirthDate(normalized)) {
    return { ngay: "", thang: "", nam: "" };
  }
  const [dd, mm, yyyy] = normalized.split("/");
  return { ngay: String(Number(dd)), thang: String(Number(mm)), nam: yyyy };
}

export function birthDateFromParts(
  ngay: unknown,
  thang: unknown,
  nam: unknown
): string {
  const d = Number(String(ngay ?? "").replace(/\D/g, ""));
  const m = Number(String(thang ?? "").replace(/\D/g, ""));
  const y = Number(String(nam ?? "").replace(/\D/g, ""));
  if (!isRealCalendarDate(d, m, y)) return "";
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** Format đang gõ thành DD/MM/YYYY (chỉ số + /). */
export function maskBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function birthDateError(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    return "Ngày sinh phải theo định dạng DD/MM/YYYY (vd: 15/08/2005)";
  }
  if (!isValidBirthDate(raw)) {
    return "Ngày sinh không hợp lệ (ngày/tháng không tồn tại hoặc năm ngoài khoảng cho phép)";
  }
  return null;
}

export function phoneError(value: unknown, required = false): string | null {
  const digits = digitsPhone10(value);
  const raw = normalizeText(value);
  if (!raw && !required) return null;
  if (!digits) return required ? "Nhập số điện thoại 10 số" : null;
  if (digits.length !== 10) return "Số điện thoại phải đủ đúng 10 chữ số";
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isRealCalendarDate(day: number, month: number, year: number) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return false;
  }
  if (year < 1950 || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

export function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function normalizeCccd(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "");
}

export function normalizeName(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date heuristic skipped; keep number as string
    return String(value);
  }
  return normalizeText(value);
}

export function inferDocumentStatus(raw: string): "du" | "thieu" | "co_file" {
  const v = raw.toLowerCase();
  if (!v) return "thieu";
  if (/(đủ|du|ok|x|có|co|yes|true|1)/i.test(v) && !/thiếu|thieu|không|khong/.test(v)) {
    return "du";
  }
  if (/file|ảnh|anh|pdf|upload/i.test(v)) return "co_file";
  if (/thiếu|thieu|không|khong|no|0/.test(v)) return "thieu";
  // Non-empty note without clear flag → treat as đủ (info filled)
  return "du";
}
