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

/** Ordered Excel columns (Vietnamese header → field key), matching import layout. */
export const EXCEL_HEADER_ORDER: { label: string; key: string }[] = Object.entries(
  EXCEL_COLUMN_MAP
).map(([label, key]) => ({ label, key }));

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
