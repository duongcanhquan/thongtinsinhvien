"use client";

import {
  ArrowsLeftRight,
  Check,
  ClipboardText,
  DownloadSimple,
  Eye,
  FileArrowUp,
  FileXls,
  MagnifyingGlass,
  Plus,
  SignOut,
  UserPlus,
  Users,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ADMIN_EDITABLE_FIELDS,
  DOCUMENT_LABELS,
  FIELD_LABELS,
  STUDENT_EDITABLE_FIELDS,
  birthDateFromParts,
  isValidBirthDate,
  normalizeBirthDate,
} from "@/lib/student-fields";
import type {
  ChangeRequest,
  DocumentSlot,
  Student,
  StudentIdentity,
  UploadedFile,
} from "@/lib/types";
import {
  BirthDateFields,
  PhoneField,
  isPhoneKey,
  validateProfileFields,
} from "@/components/form-fields";

type Tab = "requests" | "students" | "create" | "import";
type EditMode = "create" | "edit";
type RequestRow = ChangeRequest & { student?: StudentIdentity };

const FIELD_GROUPS: { title: string; keys: readonly string[] }[] = [
  {
    title: "Thông tin cá nhân",
    keys: [
      "stt",
      "hoVaTen",
      "hoVa",
      "ten",
      "gioiTinh",
      "ngaySinh",
      "noiSinh",
      "danToc",
      "canCuoc",
      "soDienThoai",
      "emailCaNhan",
      "emailTruong",
    ],
  },
  {
    title: "Địa chỉ",
    keys: ["khuVuc", "diaChiThuongTru", "diaChiTamTru"],
  },
  {
    title: "Học vụ",
    keys: [
      "heDaoTao",
      "khoaDaoTao",
      "nganh",
      "lop",
      "lopChuNhiemThang89",
      "ghiChuXepLop",
      "khoaBanDau",
      "khoaHienTai",
      "ngayNhapHoc",
      "coSoHoc",
      "tuVanTuyenSinh",
      "svDaCoLaptop",
      "xepLopTinHoc",
      "mayTinhHocTap",
    ],
  },
  {
    title: "Gia đình",
    keys: ["hoTenCha", "sdtCha", "hoTenMe", "sdtMe", "nguoiGiamHo", "sdtNguoiGiamHo"],
  },
  {
    title: "THPT & khác",
    keys: [
      "truongThpt",
      "tinhTruong",
      "doiTuong",
      "diemTrungBinh",
      "hocBong",
      "thongTinSaiLech",
      "ghiChuHoSo",
    ],
  },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [requestStudent, setRequestStudent] = useState<Student | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("edit");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const res = await fetch("/api/admin/requests");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
    }
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error || "Đăng nhập thất bại");
      return;
    }
    setAuthed(true);
    await refreshRequests();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  async function refreshRequests() {
    const res = await fetch("/api/admin/requests");
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
    }
  }

  async function openRequest(r: RequestRow) {
    setSelected(r);
    setNote("");
    setError("");
    const res = await fetch(`/api/admin/students/${encodeURIComponent(r.maSinhVien)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không tải được hồ sơ SV");
      setRequestStudent(null);
      setEditDraft({});
      return;
    }
    const student = data.student as Student;
    setRequestStudent(student);
    const draft: Record<string, string> = {};
    for (const key of STUDENT_EDITABLE_FIELDS) {
      const proposed = r.proposedFields?.[key];
      draft[key] =
        proposed != null
          ? String(proposed)
          : String((student as Record<string, unknown>)[key] ?? "");
    }
    setEditDraft(draft);
  }

  function closeRequestDetail() {
    setSelected(null);
    setRequestStudent(null);
    setNote("");
    setEditDraft({});
  }

  const changedKeys = useMemo(() => {
    if (!selected || !requestStudent) return [] as string[];
    const keys: string[] = [];
    for (const key of STUDENT_EDITABLE_FIELDS) {
      if (!(key in (selected.proposedFields || {}))) continue;
      const next = String(selected.proposedFields?.[key] ?? "");
      const prev = String((requestStudent as Record<string, unknown>)[key] ?? "");
      if (next !== prev) keys.push(key);
    }
    return keys;
  }, [selected, requestStudent]);

  const changedDocs = useMemo(() => {
    if (!selected || !requestStudent) return [] as string[];
    const keys: string[] = [];
    for (const [key, slot] of Object.entries(selected.proposedDocuments || {})) {
      const curr = requestStudent.documents?.[key];
      const currKeys = (curr?.files || []).map((f) => f.key).join("|");
      const nextKeys = (slot.files || []).map((f) => f.key).join("|");
      if (
        currKeys !== nextKeys ||
        (slot.status || "") !== (curr?.status || "") ||
        (slot.note || "") !== (curr?.note || "")
      ) {
        keys.push(key);
      }
    }
    return keys;
  }, [selected, requestStudent]);

  async function searchStudents(e?: FormEvent) {
    e?.preventDefault();
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Lỗi tìm kiếm");
      return;
    }
    setStudents(data.students || []);
  }

  async function openStudent(s: Student) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(s.maSinhVien)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải hồ sơ");
      setEditMode("edit");
      setEditStudent(data.student);
      setTab("students");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  function startCreateStudent() {
    setError("");
    setMessage("");
    setEditMode("create");
    setEditStudent(blankStudent());
    setTab("create");
  }

  function openCreateTab() {
    setTab("create");
    // Luôn mở form trống khi vào tab nhập mới (trừ khi vừa tạo xong đang sửa tiếp)
    if (editMode !== "create" || !editStudent) {
      setError("");
      setMessage("");
      setEditMode("create");
      setEditStudent(blankStudent());
    }
  }

  async function decide(action: "approve" | "reject" | "edit_approve") {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = { action, adminNote: note };
      if (action === "edit_approve") {
        // Gửi đủ đề xuất từ request + overlay admin đang sửa trên UI
        const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(selected.proposedFields || {})) {
          fields[k] = String(v ?? "");
        }
        for (const key of changedKeys) {
          fields[key] = editDraft[key] ?? fields[key] ?? "";
        }
        if (requestStudent) {
          for (const key of STUDENT_EDITABLE_FIELDS) {
            const draft = editDraft[key] ?? "";
            const official = String(
              (requestStudent as Record<string, unknown>)[key] ?? ""
            );
            if (draft !== official) fields[key] = draft;
          }
        }
        body.proposedFields = fields;
        body.proposedDocuments = selected.proposedDocuments || {};
      }
      const res = await fetch(`/api/admin/requests/${selected.maSinhVien}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thất bại");
      const applied = (data.appliedFields || []) as string[];
      setMessage(
        data.rejected
          ? "Đã từ chối — giữ nguyên dữ liệu cũ."
          : applied.length
            ? `Đã duyệt và cập nhật chính thức: ${applied.join(", ")}`
            : "Đã duyệt yêu cầu."
      );
      closeRequestDetail();
      await refreshRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function saveStudent() {
    if (!editStudent) return;
    const ma = String(editStudent.maSinhVien || "").trim();
    if (!ma) {
      setError("Nhập mã sinh viên");
      return;
    }
    if (!String(editStudent.hoVaTen || "").trim()) {
      setError("Nhập họ và tên");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      let nextStudent = { ...editStudent };
      const normalized = normalizeBirthDate(String(nextStudent.ngaySinh || ""));
      if (isValidBirthDate(normalized)) {
        const [dd, mm, yyyy] = normalized.split("/");
        nextStudent = {
          ...nextStudent,
          ngaySinh: normalized,
          ngay: String(Number(dd)),
          thang: String(Number(mm)),
          nam: yyyy,
        };
      } else if (nextStudent.ngay || nextStudent.thang || nextStudent.nam) {
        const composed = birthDateFromParts(
          nextStudent.ngay,
          nextStudent.thang,
          nextStudent.nam
        );
        if (composed) nextStudent = { ...nextStudent, ngaySinh: composed };
      }

      const fields: Record<string, string> = {};
      for (const key of ADMIN_EDITABLE_FIELDS) {
        fields[key] = String((nextStudent as Record<string, unknown>)[key] ?? "");
      }
      const invalid = validateProfileFields(fields);
      if (invalid) throw new Error(invalid);
      setEditStudent(nextStudent);

      if (editMode === "create") {
        const res = await fetch("/api/admin/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maSinhVien: ma,
            fields,
            documents: nextStudent.documents,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Tạo thất bại");
        setEditMode("edit");
        setEditStudent(data.student);
        setMessage("Đã tạo sinh viên thành công.");
        setQ(ma);
        await searchStudents();
      } else {
        const res = await fetch(`/api/admin/students/${encodeURIComponent(ma)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields,
            documents: nextStudent.documents,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lưu thất bại");
        setEditStudent(data.student);
        setMessage("Đã lưu thay đổi.");
        await searchStudents();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function uploadStudentFile(fieldKey: string, fileList: FileList | null) {
    if (!fileList?.length || !editStudent) return;
    const ma = String(editStudent.maSinhVien || "").trim();
    if (!ma) {
      setError("Nhập mã sinh viên trước khi upload tài liệu");
      return;
    }

    const existing = editStudent.documents?.[fieldKey]?.files || [];
    const replace = existing.length >= 2;
    const room = Math.max(0, 2 - existing.length);
    const incoming = Array.from(fileList).slice(0, replace ? 2 : room || 2);
    if (!incoming.length) return;

    setUploadingKey(fieldKey);
    setError("");
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of incoming) {
        const contentType =
          file.type || guessClientContentType(file.name) || "application/octet-stream";
        const metaRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maSinhVien: ma,
            fieldKey,
            filename: file.name,
            contentType,
            size: file.size,
          }),
        });
        const meta = await metaRes.json();
        if (!metaRes.ok) throw new Error(meta.error || "Không tạo được URL upload");

        const put = await fetch(meta.url, {
          method: "PUT",
          headers: { "Content-Type": meta.contentType || contentType },
          body: file,
        });
        if (!put.ok) throw new Error(`Tải file thất bại: ${file.name}`);

        uploaded.push({
          key: meta.key,
          name: meta.name,
          size: meta.size,
          contentType: meta.contentType || contentType,
          uploadedAt: meta.uploadedAt,
        });
      }

      const prevFiles = editStudent.documents?.[fieldKey]?.files || [];
      const nextFiles = replace
        ? uploaded.slice(0, 2)
        : [...prevFiles, ...uploaded].slice(0, 2);
      const nextDocuments = {
        ...(editStudent.documents || {}),
        [fieldKey]: {
          status: "co_file" as const,
          files: nextFiles,
          note: editStudent.documents?.[fieldKey]?.note,
        },
      };

      // Đã có SV trong hệ thống → lưu file ngay vào hồ sơ chính thức
      if (editMode === "edit") {
        const res = await fetch(`/api/admin/students/${encodeURIComponent(ma)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents: nextDocuments }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lưu file thất bại");
        setEditStudent(data.student);
        setMessage("Đã upload và lưu tài liệu vào hồ sơ sinh viên.");
      } else {
        setEditStudent({
          ...editStudent,
          documents: nextDocuments,
        });
        setMessage("Đã gắn file (nhớ bấm Tạo sinh viên để lưu hồ sơ).");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi upload");
    } finally {
      setUploadingKey(null);
    }
  }

  async function removeStudentFile(fieldKey: string, fileKey: string) {
    if (!editStudent) return;
    const ma = String(editStudent.maSinhVien || "").trim();
    const slot = editStudent.documents?.[fieldKey];
    if (!slot) return;
    const nextFiles = (slot.files || []).filter((f) => f.key !== fileKey);
    const nextDocuments = {
      ...(editStudent.documents || {}),
      [fieldKey]: {
        ...slot,
        status: nextFiles.length ? ("co_file" as const) : ("thieu" as const),
        files: nextFiles,
      },
    };

    if (editMode === "create" || !ma) {
      setEditStudent({ ...editStudent, documents: nextDocuments });
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(ma)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: nextDocuments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa file thất bại");
      setEditStudent(data.student);
      setMessage("Đã xóa file khỏi hồ sơ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File | null) {
    if (!file) return;
    setBusy(true);
    setImportResult("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import thất bại");
      setImportResult(
        `Thêm mới: ${data.added}. Bỏ qua (đã có): ${data.skipped}. Cập nhật link ảnh: ${data.linksUpdated || 0}. Lỗi: ${(data.errors || []).length}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export thất bại");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sinh-vien-export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function downloadKey(key: string) {
    const res = await fetch(`/api/download?key=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không tải được");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function previewFile(file: UploadedFile) {
    const res = await fetch(`/api/download?key=${encodeURIComponent(file.key)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không xem được");
      return;
    }
    if ((file.contentType || "").startsWith("image/")) {
      setPreviewUrl(data.url);
    } else {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }

  if (authed === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-hero-from/5 to-background text-foreground/70">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-primary/20" />
          <p className="text-sm font-medium">Đang kiểm tra phiên admin…</p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-hero-from via-primary to-secondary" />
        <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-7 shadow-2xl backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Cao Đẳng Việt Mỹ
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-primary">
            Admin QLĐT
          </h1>
          <p className="mt-2 text-sm text-foreground/65">
            Đăng nhập để duyệt yêu cầu, quản lý hồ sơ và import/export.
          </p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-foreground/80">
              Mật khẩu quản trị
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base shadow-sm"
                autoComplete="current-password"
                required
              />
            </label>
            {loginError ? (
              <p
                className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-bold text-on-primary shadow-lg shadow-primary/25 transition hover:bg-secondary"
            >
              Đăng nhập Admin
            </button>
          </form>
          <Link
            href="/"
            className="mt-5 block text-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            ← Về trang tra cứu sinh viên
          </Link>
        </div>
      </main>
    );
  }

  const editCount = requests.filter((r) => r.intent !== "confirm").length;
  const confirmCount = requests.filter((r) => r.intent === "confirm").length;

  const tabs: { id: Tab; label: string; hint: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "requests",
      label: "Yêu cầu sửa",
      hint: "Duyệt / từ chối",
      icon: <ClipboardText size={18} weight="bold" />,
      badge: requests.length,
    },
    {
      id: "students",
      label: "Sinh viên",
      hint: "Tìm & sửa hồ sơ",
      icon: <Users size={18} weight="bold" />,
    },
    {
      id: "create",
      label: "Nhập sinh viên",
      hint: "Tạo hồ sơ mới",
      icon: <UserPlus size={18} weight="bold" />,
    },
    {
      id: "import",
      label: "Import / Export",
      hint: "Excel hàng loạt",
      icon: <ArrowsLeftRight size={18} weight="bold" />,
    },
  ];

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#e8eef8_0%,#f3f6fb_28%,#f3f6fb_100%)]">
      <div className="border-b border-border/80 bg-gradient-to-r from-hero-from to-hero-to text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              Cao Đẳng Việt Mỹ · Hà Nội
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold sm:text-3xl">
              Quản lý đào tạo
            </h1>
            <p className="mt-1 text-sm text-white/75">
              Admin là cổng cuối duyệt dữ liệu sinh viên
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <SignOut size={18} /> Đăng xuất
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Chờ duyệt"
            value={String(requests.length)}
            tone="amber"
            onClick={() => setTab("requests")}
          />
          <StatCard
            label="Yêu cầu chỉnh sửa"
            value={String(editCount)}
            tone="red"
            onClick={() => setTab("requests")}
          />
          <StatCard
            label="Xác nhận đúng"
            value={String(confirmCount)}
            tone="green"
            onClick={() => setTab("requests")}
          />
        </div>

        <nav
          className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Admin tabs"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === "create") openCreateTab();
                  else setTab(t.id);
                }}
                className={`relative flex min-h-[4.5rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-primary bg-primary text-on-primary shadow-lg shadow-primary/20"
                    : "border-border bg-surface text-foreground hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${
                    active ? "bg-white/15" : "bg-muted"
                  }`}
                >
                  {t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-tight">{t.label}</span>
                  <span
                    className={`mt-0.5 block text-xs ${
                      active ? "text-white/75" : "text-foreground/55"
                    }`}
                  >
                    {t.hint}
                  </span>
                </span>
                {typeof t.badge === "number" && t.badge > 0 ? (
                  <span
                    className={`absolute right-3 top-3 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${
                      active ? "bg-accent text-white" : "bg-accent text-white"
                    }`}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {error ? (
          <p
            className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
            role="alert"
          >
            <X size={18} className="mt-0.5 shrink-0" weight="bold" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              className="text-xs font-bold underline"
              onClick={() => setError("")}
            >
              Đóng
            </button>
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <Check size={18} className="mt-0.5 shrink-0" weight="bold" />
            <span className="flex-1">{message}</span>
            <button
              type="button"
              className="text-xs font-bold underline"
              onClick={() => setMessage("")}
            >
              Đóng
            </button>
          </p>
        ) : null}

      {tab === "requests" ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-extrabold text-primary">
                  Hàng chờ duyệt
                </h2>
                <p className="text-sm text-foreground/55">
                  Bấm một dòng để xem thay đổi và Valid / Từ chối
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshRequests()}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-primary"
              >
                Làm mới
              </button>
            </div>
            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
                <ClipboardText size={36} className="mx-auto text-foreground/30" />
                <p className="mt-3 font-semibold text-foreground/70">
                  Không có yêu cầu pending
                </p>
                <p className="mt-1 text-sm text-foreground/50">
                  Khi sinh viên gửi chỉnh sửa, yêu cầu sẽ hiện tại đây.
                </p>
              </div>
            ) : (
              requests.map((r) => {
                const id = r.student;
                const active = selected?.maSinhVien === r.maSinhVien;
                const fieldCount = Object.keys(r.proposedFields || {}).length;
                const docCount = Object.keys(r.proposedDocuments || {}).length;
                return (
                  <button
                    key={r.maSinhVien}
                    type="button"
                    onClick={() => void openRequest(r)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
                      active
                        ? "border-primary bg-primary/[0.06] ring-2 ring-primary/25"
                        : "border-border bg-surface hover:border-primary/35 hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-display text-base font-extrabold leading-snug text-primary">
                        {id?.hoVaTen || "—"}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                          r.intent === "confirm"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-950"
                        }`}
                      >
                        {r.intent === "confirm" ? "Xác nhận đúng" : "Chỉnh sửa"}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-sm">
                      <Row label="Mã sinh viên" value={r.maSinhVien} mono />
                      <Row label="CCCD" value={id?.canCuoc || "—"} />
                      <Row label="Số điện thoại" value={id?.soDienThoai || "—"} />
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-foreground/50">
                      <span className="rounded-lg bg-muted px-2 py-1">
                        {fieldCount} trường
                      </span>
                      <span className="rounded-lg bg-muted px-2 py-1">
                        {docCount} giấy tờ
                      </span>
                      <span className="ml-auto">
                        {new Date(r.updatedAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Desktop: panel bên phải */}
          <div className="hidden lg:block">
            {selected && requestStudent ? (
              <RequestDetailPanel
                selected={selected}
                requestStudent={requestStudent}
                changedKeys={changedKeys}
                changedDocs={changedDocs}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                note={note}
                setNote={setNote}
                busy={busy}
                decide={decide}
                downloadKey={downloadKey}
                previewFile={previewFile}
              />
            ) : selected ? (
              <p className="text-sm text-foreground/60">Đang tải hồ sơ sinh viên…</p>
            ) : (
              <div className="sticky top-4 rounded-2xl border border-dashed border-border bg-surface/80 px-6 py-16 text-center">
                <ClipboardText size={40} className="mx-auto text-foreground/25" />
                <p className="mt-3 font-semibold text-foreground/70">
                  Chưa chọn yêu cầu
                </p>
                <p className="mt-1 text-sm text-foreground/50">
                  Bấm một dòng bên trái để xem diff và Valid / Từ chối.
                </p>
              </div>
            )}
          </div>

          {/* Mobile: popup */}
          {selected ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 lg:hidden">
              <div
                className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Chi tiết yêu cầu chỉnh sửa"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="font-semibold">Chi tiết yêu cầu</h2>
                  <button
                    type="button"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border"
                    onClick={closeRequestDetail}
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto p-4">
                  {requestStudent ? (
                    <RequestDetailPanel
                      selected={selected}
                      requestStudent={requestStudent}
                      changedKeys={changedKeys}
                      changedDocs={changedDocs}
                      editDraft={editDraft}
                      setEditDraft={setEditDraft}
                      note={note}
                      setNote={setNote}
                      busy={busy}
                      decide={decide}
                      downloadKey={downloadKey}
                      previewFile={previewFile}
                      compact
                    />
                  ) : (
                    <p className="text-sm text-foreground/60">Đang tải hồ sơ…</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "students" ? (
        <section className="mt-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-primary">
              Tìm & sửa hồ sơ
            </h2>
            <p className="text-sm text-foreground/55">
              Tra cứu nhanh rồi mở form chỉnh sửa toàn bộ thông tin / giấy tờ
            </p>
          </div>
          <form
            onSubmit={(e) => void searchStudents(e)}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:flex-row sm:items-center"
          >
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tên / email / SĐT / CCCD / mã SV"
                className="min-h-12 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition hover:bg-secondary"
            >
              <MagnifyingGlass weight="bold" /> Tìm kiếm
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                    Mã SV
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                    Họ tên
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-bold uppercase tracking-wide sm:table-cell">
                    SĐT
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-bold uppercase tracking-wide md:table-cell">
                    CCCD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-foreground/50"
                    >
                      Nhập từ khóa và bấm Tìm kiếm để hiện danh sách.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr
                      key={s.maSinhVien}
                      className="border-t border-border/70 transition hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {s.maSinhVien}
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        {s.hoVaTen}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {s.soDienThoai || "—"}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {s.canCuoc || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center rounded-xl bg-accent px-3 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
                          onClick={() => void openStudent(s)}
                        >
                          Xem / Sửa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {editStudent && editMode === "edit" ? (
            <StudentEditor
              editStudent={editStudent}
              editMode={editMode}
              busy={busy}
              uploadingKey={uploadingKey}
              onClose={() => {
                setEditStudent(null);
                setEditMode("edit");
                setMessage("");
              }}
              setEditStudent={setEditStudent}
              setError={setError}
              saveStudent={() => void saveStudent()}
              uploadStudentFile={uploadStudentFile}
              removeStudentFile={removeStudentFile}
              downloadKey={downloadKey}
              previewFile={previewFile}
            />
          ) : null}
        </section>
      ) : null}

      {tab === "create" ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div>
              <h2 className="font-display text-lg font-extrabold text-primary">
                Nhập sinh viên mới
              </h2>
              <p className="text-sm text-foreground/55">
                Thông tin trước → giấy tờ dưới → bấm Tạo sinh viên
              </p>
            </div>
            <button
              type="button"
              onClick={startCreateStudent}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-primary/20 bg-muted px-4 text-sm font-bold text-primary transition hover:border-primary/40"
            >
              <Plus weight="bold" /> Làm mới form
            </button>
          </div>
          {editStudent ? (
            <StudentEditor
              editStudent={editStudent}
              editMode={editMode === "create" ? "create" : "edit"}
              busy={busy}
              uploadingKey={uploadingKey}
              onClose={() => {
                startCreateStudent();
              }}
              setEditStudent={setEditStudent}
              setError={setError}
              saveStudent={() => void saveStudent()}
              uploadStudentFile={uploadStudentFile}
              removeStudentFile={removeStudentFile}
              downloadKey={downloadKey}
              previewFile={previewFile}
              hideClose
            />
          ) : null}
        </section>
      ) : null}

      {tab === "import" ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <FileXls size={24} weight="bold" />
            </div>
            <h2 className="font-display mt-4 text-lg font-extrabold text-primary">
              Import Excel
            </h2>
            <p className="mt-2 text-sm text-foreground/65">
              Đọc từ dòng 3. Mã sinh viên đã có sẽ được bỏ qua (không ghi đè
              thông tin), nhưng <strong>link Drive cột ẢNH</strong> vẫn được
              cập nhật nếu Excel có hyperlink.
            </p>
            <label className="mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-muted/50 px-5 text-sm font-bold text-primary transition hover:border-primary hover:bg-muted">
              <FileArrowUp size={18} weight="bold" />
              Chọn file .xlsx
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => void onImport(e.target.files?.[0] || null)}
              />
            </label>
            {importResult ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                {importResult}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <DownloadSimple size={24} weight="bold" />
            </div>
            <h2 className="font-display mt-4 text-lg font-extrabold text-primary">
              Export Excel
            </h2>
            <p className="mt-2 text-sm text-foreground/65">
              Xuất đúng khuôn file gốc: sheet CAO ĐẲNG, dòng 1 tiếng Anh, dòng 2
              tiếng Việt, thứ tự / khoảng cột giữ nguyên — mở dùng được ngay.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onExport()}
              className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition hover:bg-secondary disabled:opacity-50"
            >
              <FileXls size={18} weight="bold" /> Tải file Excel
            </button>
          </div>
          {busy ? (
            <p className="text-sm font-medium text-foreground/60 lg:col-span-2">
              Đang xử lý file…
            </p>
          ) : null}
        </section>
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewUrl(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Xem trước ảnh"
            className="max-h-[85dvh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
      </div>
    </main>
  );
}

function RequestDetailPanel({
  selected,
  requestStudent,
  changedKeys,
  changedDocs,
  editDraft,
  setEditDraft,
  note,
  setNote,
  busy,
  decide,
  downloadKey,
  previewFile,
  compact,
}: {
  selected: RequestRow;
  requestStudent: Student;
  changedKeys: string[];
  changedDocs: string[];
  editDraft: Record<string, string>;
  setEditDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  decide: (action: "approve" | "reject" | "edit_approve") => Promise<void>;
  downloadKey: (key: string) => Promise<void>;
  previewFile: (file: UploadedFile) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <div
      className={`space-y-4 ${
        compact
          ? ""
          : "sticky top-4 rounded-2xl border border-border bg-surface p-5 shadow-md"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-extrabold text-primary">
            {selected.intent === "confirm" ? "Xác nhận đúng" : "Yêu cầu chỉnh sửa"}
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
              selected.intent === "confirm"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-950"
            }`}
          >
            {changedKeys.length + changedDocs.length} thay đổi
          </span>
        </div>
        <dl className="mt-3 grid gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-sm sm:grid-cols-2">
          <Info label="Họ và tên" value={requestStudent.hoVaTen} />
          <Info label="Mã sinh viên" value={requestStudent.maSinhVien} />
          <Info label="CCCD" value={String(requestStudent.canCuoc || "")} />
          <Info label="SĐT" value={String(requestStudent.soDienThoai || "")} />
        </dl>
      </div>

      {selected.intent !== "confirm" ? (
        <>
          <div>
            <h3 className="text-sm font-bold text-primary">Trường thay đổi</h3>
            {changedKeys.length === 0 && changedDocs.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">
                Không có diff trường (có thể chỉ xác nhận / file).
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-primary/95 text-xs uppercase tracking-wide text-white">
                    <tr>
                      <th className="px-3 py-2.5">Trường</th>
                      <th className="px-3 py-2.5">Cũ</th>
                      <th className="px-3 py-2.5">Mới / Admin sửa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changedKeys.map((key) => (
                      <tr key={key} className="border-t border-border/70 align-top">
                        <td className="px-3 py-2.5 font-semibold">
                          {FIELD_LABELS[key] || key}
                        </td>
                        <td className="px-3 py-2.5 break-all text-foreground/55">
                          {String(
                            (requestStudent as Record<string, unknown>)[key] ?? "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            className="min-h-10 w-full rounded-lg border-2 border-accent/40 bg-accent-soft/40 px-2 font-medium"
                            value={editDraft[key] || ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {changedDocs.length ? (
            <div>
              <h3 className="text-sm font-bold text-primary">
                Giấy tờ thay đổi (cũ → mới)
              </h3>
              <div className="mt-2 space-y-3">
                {changedDocs.map((key) => {
                  const slot = selected.proposedDocuments?.[key];
                  const curr = requestStudent.documents?.[key];
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-border bg-muted/30 p-3 text-sm"
                    >
                      <p className="font-bold">{DOCUMENT_LABELS[key] || key}</p>
                      <p className="mt-1 text-xs text-foreground/55">
                        Trạng thái: {curr?.status || "—"} → {slot?.status || "—"}
                        {slot?.note || curr?.note
                          ? ` · Ghi chú: ${curr?.note || "—"} → ${slot?.note || "—"}`
                          : ""}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold uppercase text-foreground/50">
                            Cũ
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {(curr?.files || []).length ? (
                              (curr?.files || []).map((f) => (
                                <FileActions
                                  key={f.key}
                                  file={f}
                                  onDownload={() => void downloadKey(f.key)}
                                  onPreview={() => void previewFile(f)}
                                />
                              ))
                            ) : (
                              <span className="text-foreground/45">—</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-accent">
                            Mới
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {(slot?.files || []).length ? (
                              (slot?.files || []).map((f) => (
                                <FileActions
                                  key={f.key}
                                  file={f}
                                  onDownload={() => void downloadKey(f.key)}
                                  onPreview={() => void previewFile(f)}
                                />
                              ))
                            ) : (
                              <span className="text-foreground/45">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Sinh viên xác nhận hồ sơ hiện tại là đúng — chỉ cần Valid hoặc Từ chối.
        </p>
      )}

      <label className="block text-sm font-semibold">
        Ghi chú admin
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tuỳ chọn — lý do từ chối / ghi chú duyệt…"
          className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-white px-3"
        />
      </label>

      <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t border-border bg-surface/95 pt-3 backdrop-blur sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void decide(selected.intent === "confirm" ? "approve" : "edit_approve")
          }
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check size={20} weight="bold" /> Valid / Duyệt
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("reject")}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-white px-4 text-base font-extrabold text-destructive transition hover:bg-destructive hover:text-white disabled:opacity-50"
        >
          <X size={20} weight="bold" /> Từ chối
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: "amber" | "red" | "green";
  onClick?: () => void;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:shadow-md ${tones[tone]}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="font-display mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
    </button>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-foreground/50">{label}</dt>
      <dd className={`break-all ${mono ? "font-mono font-semibold" : "font-medium"}`}>
        {value}
      </dd>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-foreground/50">{label}</dt>
      <dd className="mt-0.5 font-semibold break-all">{value || "—"}</dd>
    </div>
  );
}

function StudentEditor({
  editStudent,
  editMode,
  busy,
  uploadingKey,
  onClose,
  setEditStudent,
  setError,
  saveStudent,
  uploadStudentFile,
  removeStudentFile,
  downloadKey,
  previewFile,
  hideClose,
}: {
  editStudent: Student;
  editMode: EditMode;
  busy: boolean;
  uploadingKey: string | null;
  onClose: () => void;
  setEditStudent: (s: Student) => void;
  setError: (s: string) => void;
  saveStudent: () => void;
  uploadStudentFile: (fieldKey: string, fileList: FileList | null) => Promise<void>;
  removeStudentFile: (fieldKey: string, fileKey: string) => Promise<void>;
  downloadKey: (key: string) => Promise<void>;
  previewFile: (file: UploadedFile) => Promise<void>;
  hideClose?: boolean;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="font-display text-xl font-extrabold text-primary">
            {editMode === "create"
              ? "Form nhập sinh viên"
              : editStudent.hoVaTen || "Hồ sơ sinh viên"}
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            {editMode === "create"
              ? "Điền thông tin trước, giấy tờ phía dưới."
              : `Mã SV: ${editStudent.maSinhVien}`}
          </p>
        </div>
        {!hideClose ? (
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-xl border border-border px-3 text-sm font-semibold text-foreground/70 hover:bg-muted"
            onClick={onClose}
          >
            Đóng
          </button>
        ) : null}
      </div>

      <label className="block text-sm">
        Mã sinh viên {editMode === "create" ? "(bắt buộc)" : "(không sửa)"}
        <input
          className={`mt-1 min-h-11 w-full rounded-lg border border-border px-3 ${
            editMode === "edit" ? "bg-muted/40" : ""
          }`}
          value={editStudent.maSinhVien}
          readOnly={editMode === "edit"}
          onChange={(e) => {
            if (editMode !== "create") return;
            const hasFiles = Object.values(editStudent.documents || {}).some(
              (d) => (d.files || []).length > 0
            );
            if (hasFiles) {
              setError(
                "Không đổi mã SV sau khi đã upload file — xóa file hoặc tạo mới."
              );
              return;
            }
            setEditStudent({
              ...editStudent,
              maSinhVien: e.target.value.trim(),
            });
          }}
          placeholder="VD: 51112610099"
        />
      </label>

      {FIELD_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="mb-2 font-semibold text-primary">{group.title}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.keys.map((key) => {
              if (key === "ngaySinh") {
                return (
                  <BirthDateFields
                    key={key}
                    ngaySinh={String(editStudent.ngaySinh || "")}
                    ngay={String(editStudent.ngay || "")}
                    thang={String(editStudent.thang || "")}
                    nam={String(editStudent.nam || "")}
                    inputClassName="min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
                    onChange={(next) =>
                      setEditStudent({
                        ...editStudent,
                        ...next,
                      })
                    }
                  />
                );
              }
              if (isPhoneKey(key)) {
                return (
                  <PhoneField
                    key={key}
                    label={FIELD_LABELS[key] || key}
                    value={String(
                      (editStudent as Record<string, unknown>)[key] ?? ""
                    )}
                    inputClassName="min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
                    onChange={(v) =>
                      setEditStudent({
                        ...editStudent,
                        [key]: v,
                      })
                    }
                  />
                );
              }
              return (
                <label key={key} className="text-sm">
                  {FIELD_LABELS[key] || key}
                  {key === "hoVaTen" ? " *" : ""}
                  <input
                    className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                    value={String(
                      (editStudent as Record<string, unknown>)[key] ?? ""
                    )}
                    onChange={(e) =>
                      setEditStudent({
                        ...editStudent,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h3 className="mb-2 font-semibold text-primary">
          Giấy tờ / ảnh — Admin được bổ sung / thay thế mọi mục
        </h3>
        <p className="mb-3 text-sm text-foreground/60">
          <span className="font-semibold text-emerald-700">Xanh = Đủ</span>,{" "}
          <span className="font-semibold text-destructive">Đỏ = Thiếu</span>.
          Admin luôn có quyền upload/thay file mọi trường (kể cả đã Đủ).
        </p>
        <div className="space-y-3">
          {Object.entries(DOCUMENT_LABELS).map(([key, label]) => {
            const slot: DocumentSlot =
              editStudent.documents?.[key] || {
                status: "thieu",
                files: [],
              };
            const busyUpload = uploadingKey === key;
            const isDu = slot.status === "du";
            const isThieu = slot.status === "thieu";
            return (
              <div
                key={key}
                className={`rounded-xl border p-3 ${
                  isDu
                    ? "border-emerald-200 bg-emerald-50/80"
                    : isThieu
                      ? "border-destructive/25 bg-red-50/70"
                      : "border-amber-200 bg-amber-50/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{label}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${
                        isDu
                          ? "bg-emerald-600"
                          : isThieu
                            ? "bg-destructive"
                            : "bg-amber-500"
                      }`}
                    >
                      {isDu ? "Đủ" : isThieu ? "Thiếu" : "Có file"}
                    </span>
                    {slot.note ? (
                      <p className="mt-1 text-xs text-foreground/55">{slot.note}</p>
                    ) : null}
                    {slot.externalUrl ? (
                      <a
                        href={slot.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-primary/30 bg-white px-3 text-sm font-bold text-primary hover:bg-muted"
                      >
                        Xem ảnh Drive
                        {slot.note ? ` · ${slot.note}` : ""}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm"
                      value={slot.status}
                      onChange={(e) =>
                        setEditStudent({
                          ...editStudent,
                          documents: {
                            ...(editStudent.documents || {}),
                            [key]: {
                              ...slot,
                              status: e.target.value as DocumentSlot["status"],
                            },
                          },
                        })
                      }
                    >
                      <option value="thieu">Thiếu</option>
                      <option value="du">Đủ</option>
                      <option value="co_file">Có file</option>
                    </select>
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
                      <FileArrowUp size={16} weight="bold" />
                      {busyUpload ? "Đang tải…" : "Bổ sung / thay thế"}
                      <input
                        type="file"
                        accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                        multiple
                        disabled={busy || busyUpload}
                        className="sr-only"
                        onChange={(e) => {
                          void uploadStudentFile(key, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(slot.files || []).map((f) => (
                    <div key={f.key} className="inline-flex items-center gap-1">
                      <FileActions
                        file={f}
                        onDownload={() => void downloadKey(f.key)}
                        onPreview={() => void previewFile(f)}
                      />
                      <button
                        type="button"
                        title="Xóa file"
                        className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-destructive"
                        onClick={() => void removeStudentFile(key, f.key)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {!slot.files?.length ? (
                    <span className="text-xs text-foreground/50">Chưa có file</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-1 border-t border-border bg-surface/95 pt-4 backdrop-blur">
        <button
          type="button"
          disabled={busy}
          onClick={saveStudent}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-extrabold text-on-primary shadow-lg shadow-primary/25 transition hover:bg-secondary disabled:opacity-50 sm:w-auto"
        >
          <Check size={20} weight="bold" />
          {busy
            ? "Đang lưu…"
            : editMode === "create"
              ? "Tạo sinh viên"
              : "Lưu thay đổi thông tin"}
        </button>
      </div>
    </div>
  );
}

function blankStudent(): Student {
  const documents: Record<string, DocumentSlot> = {};
  for (const key of Object.keys(DOCUMENT_LABELS)) {
    documents[key] = { status: "thieu", files: [] };
  }
  const student: Student = {
    maSinhVien: "",
    hoVaTen: "",
    documents,
  };
  for (const key of ADMIN_EDITABLE_FIELDS) {
    (student as Record<string, unknown>)[key] = "";
  }
  return student;
}

function guessClientContentType(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
  };
  return map[ext] || "";
}

function FileActions({
  file,
  onDownload,
  onPreview,
}: {
  file: UploadedFile;
  onDownload: () => void;
  onPreview: () => void;
}) {
  const isImage = (file.contentType || "").startsWith("image/");
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5 text-xs">
      <span className="max-w-[140px] truncate">{file.name}</span>
      {isImage ? (
        <button type="button" onClick={onPreview} className="text-primary" title="Xem">
          <Eye size={16} />
        </button>
      ) : null}
      <button type="button" onClick={onDownload} className="text-primary" title="Tải về">
        <DownloadSimple size={16} />
      </button>
    </div>
  );
}
