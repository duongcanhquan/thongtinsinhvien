"use client";

import {
  Check,
  DownloadSimple,
  Eye,
  FileArrowUp,
  FileXls,
  MagnifyingGlass,
  Plus,
  SignOut,
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
import type { ChangeRequest, DocumentSlot, Student, UploadedFile } from "@/lib/types";
import {
  BirthDateFields,
  PhoneField,
  isPhoneKey,
  validateProfileFields,
} from "@/components/form-fields";

type Tab = "requests" | "students" | "import";
type EditMode = "create" | "edit";

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
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
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

  async function openRequest(r: ChangeRequest) {
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
    setTab("students");
  }

  async function decide(action: "approve" | "reject" | "edit_approve") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { action, adminNote: note };
      if (action === "edit_approve") {
        // Chỉ gửi các trường admin đang xem/sửa (diff + giá trị draft)
        const fields: Record<string, string> = {};
        for (const key of changedKeys) {
          fields[key] = editDraft[key] ?? "";
        }
        // Cho phép admin chỉnh thêm bất kỳ key nào trong draft nếu khác bản chính thức
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
      setSelected(null);
      setRequestStudent(null);
      setNote("");
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
        `Thêm mới: ${data.added}. Bỏ qua (đã có): ${data.skipped}. Lỗi: ${(data.errors || []).length}`
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
      <main className="grid min-h-dvh place-items-center text-foreground/70">
        Đang kiểm tra phiên…
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <h1 className="text-3xl font-bold">Admin QLĐT</h1>
        <p className="mt-2 text-sm text-foreground/70">Đăng nhập quản lý đào tạo</p>
        <form
          onSubmit={login}
          className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5"
        >
          <label className="block text-sm font-medium">
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-border px-3"
              autoComplete="current-password"
              required
            />
          </label>
          {loginError ? (
            <p className="text-sm text-destructive" role="alert">
              {loginError}
            </p>
          ) : null}
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-primary font-semibold text-on-primary"
          >
            Đăng nhập
          </button>
        </form>
        <Link href="/" className="mt-6 text-center text-sm text-primary">
          Về trang sinh viên
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quản lý đào tạo</h1>
          <p className="text-sm text-foreground/60">{requests.length} yêu cầu đang chờ</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <SignOut /> Đăng xuất
        </button>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Admin tabs">
        {(
          [
            ["requests", "Yêu cầu sửa"],
            ["students", "Sinh viên"],
            ["import", "Import / Export"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium ${
              tab === id
                ? "bg-primary text-on-primary"
                : "border border-border bg-surface"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          {message}
        </p>
      ) : null}

      {tab === "requests" ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-foreground/60">
                Không có yêu cầu pending.
              </p>
            ) : (
              requests.map((r) => (
                <button
                  key={r.maSinhVien}
                  type="button"
                  onClick={() => void openRequest(r)}
                  className={`w-full rounded-xl border px-4 py-3 text-left ${
                    selected?.maSinhVien === r.maSinhVien
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <span className="font-mono text-sm">{r.maSinhVien}</span>
                  <span className="mt-1 block text-xs text-foreground/50">
                    {r.intent === "confirm" ? "Xác nhận đúng" : "Yêu cầu chỉnh sửa"} ·{" "}
                    {new Date(r.updatedAt).toLocaleString("vi-VN")}
                  </span>
                </button>
              ))
            )}
          </div>

          {selected && requestStudent ? (
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {selected.intent === "confirm"
                    ? "Xác nhận đúng"
                    : "Yêu cầu chỉnh sửa"}
                </h2>
                <dl className="mt-3 grid gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-2">
                  <Info label="Họ và tên" value={requestStudent.hoVaTen} />
                  <Info label="Mã sinh viên" value={requestStudent.maSinhVien} />
                  <Info label="CCCD" value={String(requestStudent.canCuoc || "")} />
                  <Info label="SĐT" value={String(requestStudent.soDienThoai || "")} />
                </dl>
              </div>

              {selected.intent !== "confirm" ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold">Trường thay đổi</h3>
                    {changedKeys.length === 0 && changedDocs.length === 0 ? (
                      <p className="mt-2 text-sm text-foreground/60">
                        Không có diff trường (có thể chỉ xác nhận / file).
                      </p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-muted/60 text-xs uppercase text-foreground/60">
                            <tr>
                              <th className="px-2 py-2">Trường</th>
                              <th className="px-2 py-2">Cũ</th>
                              <th className="px-2 py-2">Mới / Admin sửa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changedKeys.map((key) => (
                              <tr key={key} className="border-t border-border/70 align-top">
                                <td className="px-2 py-2 font-medium">
                                  {FIELD_LABELS[key] || key}
                                </td>
                                <td className="px-2 py-2 text-foreground/60 break-all">
                                  {String(
                                    (requestStudent as Record<string, unknown>)[key] ?? "—"
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    className="min-h-10 w-full rounded-lg border border-border px-2"
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
                      <h3 className="text-sm font-semibold">
                        Giấy tờ thay đổi (cũ → mới)
                      </h3>
                      <div className="mt-2 space-y-3">
                        {changedDocs.map((key) => {
                          const slot = selected.proposedDocuments?.[key];
                          const curr = requestStudent.documents?.[key];
                          return (
                            <div
                              key={key}
                              className="rounded-xl border border-border/80 p-3 text-sm"
                            >
                              <p className="font-medium">
                                {DOCUMENT_LABELS[key] || key}
                              </p>
                              <p className="mt-1 text-xs text-foreground/55">
                                Trạng thái: {curr?.status || "—"} →{" "}
                                {slot?.status || "—"}
                                {slot?.note || curr?.note
                                  ? ` · Ghi chú: ${curr?.note || "—"} → ${slot?.note || "—"}`
                                  : ""}
                              </p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase text-foreground/50">
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
                                  <p className="text-xs font-semibold uppercase text-foreground/50">
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
                <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
                  Sinh viên xác nhận hồ sơ hiện tại là đúng.
                </p>
              )}

              <label className="block text-sm">
                Ghi chú admin
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void decide(
                      selected.intent === "confirm" ? "approve" : "edit_approve"
                    )
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-50"
                >
                  <Check /> Valid / Duyệt
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("reject")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-4 font-semibold text-white disabled:opacity-50"
                >
                  <X /> Từ chối
                </button>
              </div>
            </div>
          ) : selected ? (
            <p className="text-sm text-foreground/60">Đang tải hồ sơ sinh viên…</p>
          ) : null}
        </section>
      ) : null}

      {tab === "students" ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <form
              onSubmit={(e) => void searchStudents(e)}
              className="flex flex-1 flex-col gap-2 sm:flex-row"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên / email / SĐT / CCCD / mã SV"
                className="min-h-12 flex-1 rounded-xl border border-border px-4"
              />
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-on-primary"
              >
                <MagnifyingGlass /> Tìm
              </button>
            </form>
            <button
              type="button"
              onClick={startCreateStudent}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-white"
            >
              <Plus weight="bold" /> Nhập tay SV
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/60 text-foreground/70">
                <tr>
                  <th className="px-3 py-2">Mã SV</th>
                  <th className="px-3 py-2">Họ tên</th>
                  <th className="px-3 py-2">SĐT</th>
                  <th className="px-3 py-2">CCCD</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.maSinhVien} className="border-t border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">{s.maSinhVien}</td>
                    <td className="px-3 py-2">{s.hoVaTen}</td>
                    <td className="px-3 py-2">{s.soDienThoai}</td>
                    <td className="px-3 py-2">{s.canCuoc}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-primary"
                        onClick={() => void openStudent(s)}
                      >
                        Xem / Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editStudent ? (
            <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    {editMode === "create"
                      ? "Nhập tay sinh viên mới"
                      : editStudent.hoVaTen || "Hồ sơ sinh viên"}
                  </h2>
                  <p className="text-sm text-foreground/60">
                    {editMode === "create"
                      ? "Điền thông tin + upload giấy tờ, rồi bấm Tạo sinh viên."
                      : `Mã SV: ${editStudent.maSinhVien}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-foreground/60"
                  onClick={() => {
                    setEditStudent(null);
                    setEditMode("edit");
                    setMessage("");
                  }}
                >
                  Đóng
                </button>
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
                              {isDu
                                ? "Đủ"
                                : isThieu
                                  ? "Thiếu"
                                  : "Có file"}
                            </span>
                            {slot.note ? (
                              <p className="mt-1 text-xs text-foreground/55">
                                {slot.note}
                              </p>
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
                                      status: e.target
                                        .value as DocumentSlot["status"],
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
                              {busyUpload
                                ? "Đang tải…"
                                : "Bổ sung / thay thế"}
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
                            <span className="text-xs text-foreground/50">
                              Chưa có file
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

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
                            label={
                              (FIELD_LABELS[key] || key) +
                              (key === "hoVaTen" ? " *" : "")
                            }
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

              <button
                type="button"
                disabled={busy}
                onClick={() => void saveStudent()}
                className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
              >
                {busy
                  ? "Đang lưu…"
                  : editMode === "create"
                    ? "Tạo sinh viên"
                    : "Lưu thay đổi thông tin"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "import" ? (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FileXls /> Import Excel
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              Đọc dữ liệu từ dòng 3. Trùng mã sinh viên sẽ được bỏ qua.
            </p>
            <label className="mt-4 inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-dashed border-border px-4 text-sm font-medium">
              Chọn file .xlsx
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => void onImport(e.target.files?.[0] || null)}
              />
            </label>
            {importResult ? (
              <p className="mt-4 text-sm text-accent">{importResult}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <DownloadSimple /> Export Excel
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              Xuất toàn bộ hồ sơ hiện tại (bản đã duyệt/sửa), cùng cấu trúc cột
              với file import.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onExport()}
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-on-primary disabled:opacity-50"
            >
              <FileXls /> Tải file Excel
            </button>
          </div>
          {busy ? <p className="text-sm text-foreground/60">Đang xử lý…</p> : null}
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
    </main>
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
