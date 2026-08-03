export type DocumentStatus = "du" | "thieu" | "co_file";

export type UploadedFile = {
  key: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
};

export type DocumentSlot = {
  status: DocumentStatus;
  files: UploadedFile[];
  note?: string;
};

/** Official student record (Firestore students/{maSinhVien}) */
export type Student = {
  maSinhVien: string;
  stt?: string | number;
  hoVaTen: string;
  hoVa?: string;
  ten?: string;
  gioiTinh?: string;
  ngaySinh?: string;
  ngay?: string | number;
  thang?: string | number;
  nam?: string | number;
  soDienThoai?: string;
  emailTruong?: string;
  emailCaNhan?: string;
  khuVuc?: string;
  diaChiThuongTru?: string;
  diaChiTamTru?: string;
  heDaoTao?: string;
  khoaDaoTao?: string;
  nganh?: string;
  lop?: string;
  lopChuNhiemThang89?: string;
  ghiChuXepLop?: string;
  svDaCoLaptop?: string;
  xepLopTinHoc?: string;
  khoaBanDau?: string;
  khoaHienTai?: string;
  noiSinh?: string;
  danToc?: string;
  canCuoc?: string;
  ngayNhapHoc?: string;
  tuVanTuyenSinh?: string;
  coSoHoc?: string;
  hoTenCha?: string;
  sdtCha?: string;
  hoTenMe?: string;
  sdtMe?: string;
  nguoiGiamHo?: string;
  sdtNguoiGiamHo?: string;
  truongThpt?: string;
  tinhTruong?: string;
  doiTuong?: string;
  diemTrungBinh?: string | number;
  hocBong?: string;
  thongTinSaiLech?: string;
  mayTinhHocTap?: string;
  ghiChuHoSo?: string;
  /** Document / checklist fields */
  documents: Record<string, DocumentSlot>;
  createdAt?: string;
  updatedAt?: string;
  importedAt?: string;
};

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export type ChangeRequest = {
  maSinhVien: string;
  status: ChangeRequestStatus;
  proposedFields: Partial<Omit<Student, "maSinhVien" | "documents" | "createdAt" | "importedAt">>;
  proposedDocuments: Record<string, DocumentSlot>;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type StudentIdentity = {
  maSinhVien: string;
  hoVaTen: string;
  emailCaNhan: string;
  soDienThoai: string;
  canCuoc: string;
};

export const DOCUMENT_FIELD_KEYS = [
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
] as const;

export type DocumentFieldKey = (typeof DOCUMENT_FIELD_KEYS)[number];
