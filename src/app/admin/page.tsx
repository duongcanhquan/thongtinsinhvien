"use client";

import {
  Check,
  DownloadSimple,
  FileXls,
  MagnifyingGlass,
  SignOut,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { FIELD_LABELS } from "@/lib/student-fields";
import type { ChangeRequest, Student } from "@/lib/types";

type Tab = "requests" | "students" | "import";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");

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

  async function decide(action: "approve" | "reject") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/requests/${selected.maSinhVien}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thất bại");
      setSelected(null);
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
      const { maSinhVien, documents, ...rest } = editStudent;
      const res = await fetch(`/api/admin/students/${maSinhVien}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: rest, documents }),
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

  async function downloadKey(key: string) {
    const res = await fetch(`/api/download?key=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không tải được");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
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
        <p className="mt-2 text-sm text-foreground/70">
          Đăng nhập quản lý đào tạo
        </p>
        <form onSubmit={login} className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5">
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
          <p className="text-sm text-foreground/60">
            {requests.length} yêu cầu đang chờ
          </p>
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
            ["import", "Import Excel"],
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
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
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
                  onClick={() => setSelected(r)}
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

          {selected ? (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">
                Request {selected.maSinhVien}
              </h2>
              <dl className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
                {Object.entries(selected.proposedFields || {}).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-2 gap-2 border-b border-border/50 py-1">
                    <dt className="text-foreground/60">{FIELD_LABELS[k] || k}</dt>
                    <dd>{String(v ?? "")}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">File đính kèm</p>
                {Object.entries(selected.proposedDocuments || {}).flatMap(
                  ([key, slot]) =>
                    (slot.files || []).map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => void downloadKey(f.key)}
                        className="flex min-h-10 items-center gap-2 text-sm text-primary"
                      >
                        <DownloadSimple /> {key}: {f.name}
                      </button>
                    ))
                )}
              </div>
              <label className="mt-4 block text-sm">
                Ghi chú admin
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("approve")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-50"
                >
                  <Check /> Duyệt
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
          ) : null}
        </section>
      ) : null}

      {tab === "students" ? (
        <section className="mt-6 space-y-4">
          <form onSubmit={(e) => void searchStudents(e)} className="flex flex-col gap-2 sm:flex-row">
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
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.maSinhVien} className="border-t border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">{s.maSinhVien}</td>
                    <td className="px-3 py-2">{s.hoVaTen}</td>
                    <td className="px-3 py-2">{s.soDienThoai}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-primary"
                        onClick={() => setEditStudent(s)}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editStudent ? (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">
                Sửa {editStudent.maSinhVien}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(["hoVaTen", "soDienThoai", "emailCaNhan", "canCuoc", "lop", "nganh"] as const).map(
                  (key) => (
                    <label key={key} className="text-sm">
                      {FIELD_LABELS[key]}
                      <input
                        className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                        value={String(editStudent[key] ?? "")}
                        onChange={(e) =>
                          setEditStudent({
                            ...editStudent,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </label>
                  )
                )}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">File đã lưu</p>
                {Object.entries(editStudent.documents || {}).flatMap(([key, slot]) =>
                  (slot.files || []).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => void downloadKey(f.key)}
                      className="flex items-center gap-2 text-sm text-primary"
                    >
                      <DownloadSimple /> {key}: {f.name}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveStudent()}
                className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
              >
                Lưu thay đổi
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "import" ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
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
          {busy ? <p className="mt-2 text-sm text-foreground/60">Đang xử lý…</p> : null}
        </section>
      ) : null}
    </main>
  );
}
