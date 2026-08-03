"use client";

import {
  Check,
  DownloadSimple,
  Eye,
  FileXls,
  MagnifyingGlass,
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
} from "@/lib/student-fields";
import type { ChangeRequest, DocumentSlot, Student, UploadedFile } from "@/lib/types";

type Tab = "requests" | "students" | "import";

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
      "ngay",
      "thang",
      "nam",
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
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState("");
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
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(s.maSinhVien)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải hồ sơ");
      setEditStudent(data.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: "approve" | "reject" | "edit_approve") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { action, adminNote: note };
      if (action === "edit_approve") {
        body.proposedFields = editDraft;
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
    setBusy(true);
    try {
      const fields: Record<string, string> = {};
      for (const key of ADMIN_EDITABLE_FIELDS) {
        fields[key] = String((editStudent as Record<string, unknown>)[key] ?? "");
      }
      const res = await fetch(`/api/admin/students/${editStudent.maSinhVien}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields,
          documents: editStudent.documents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu thất bại");
      setEditStudent(data.student);
      await searchStudents();
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
          <form
            onSubmit={(e) => void searchStudents(e)}
            className="flex flex-col gap-2 sm:flex-row"
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
                  <h2 className="text-lg font-semibold">{editStudent.hoVaTen}</h2>
                  <p className="font-mono text-sm text-foreground/60">
                    Mã SV: {editStudent.maSinhVien}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-foreground/60"
                  onClick={() => setEditStudent(null)}
                >
                  Đóng
                </button>
              </div>

              <label className="block text-sm">
                Mã sinh viên (không sửa)
                <input
                  className="mt-1 min-h-11 w-full rounded-lg border border-border bg-muted/40 px-3"
                  value={editStudent.maSinhVien}
                  readOnly
                />
              </label>

              {FIELD_GROUPS.map((group) => (
                <section key={group.title}>
                  <h3 className="mb-2 font-semibold text-primary">{group.title}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <label key={key} className="text-sm">
                        {FIELD_LABELS[key] || key}
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
                    ))}
                  </div>
                </section>
              ))}

              <section>
                <h3 className="mb-2 font-semibold text-primary">
                  Giấy tờ / ảnh đã upload
                </h3>
                <div className="space-y-3">
                  {Object.entries(DOCUMENT_LABELS).map(([key, label]) => {
                    const slot: DocumentSlot =
                      editStudent.documents?.[key] || {
                        status: "thieu",
                        files: [],
                      };
                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-border/80 bg-muted/30 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{label}</p>
                            <p className="text-xs text-foreground/55">
                              Trạng thái: {slot.status}
                              {slot.note ? ` · ${slot.note}` : ""}
                            </p>
                          </div>
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
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(slot.files || []).map((f) => (
                            <FileActions
                              key={f.key}
                              file={f}
                              onDownload={() => void downloadKey(f.key)}
                              onPreview={() => void previewFile(f)}
                            />
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

              <button
                type="button"
                disabled={busy}
                onClick={() => void saveStudent()}
                className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
              >
                Lưu thay đổi
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
