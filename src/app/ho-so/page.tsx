"use client";

import {
  ArrowLeft,
  CheckCircle,
  FileArrowUp,
  FloppyDisk,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DOCUMENT_LABELS,
  FIELD_LABELS,
  STUDENT_EDITABLE_FIELDS,
} from "@/lib/student-fields";
import type { ChangeRequest, DocumentSlot, Student, UploadedFile } from "@/lib/types";

export default function HoSoPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [pending, setPending] = useState<ChangeRequest | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<Record<string, DocumentSlot>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/student/me");
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!res.ok) throw new Error(data.error || "Không tải được hồ sơ");
      setStudent(data.student);
      setPending(data.pending);
      const base: Record<string, string> = {};
      for (const key of STUDENT_EDITABLE_FIELDS) {
        const fromPending = data.pending?.proposedFields?.[key];
        const value =
          fromPending != null
            ? String(fromPending)
            : String(data.student[key] ?? "");
        base[key] = value;
      }
      setFields(base);
      setDocuments({
        ...(data.student.documents || {}),
        ...(data.pending?.proposedDocuments || {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(() => fieldGroups(), []);

  async function onSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/student/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedFields: fields,
          proposedDocuments: documents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi yêu cầu thất bại");
      setPending(data.request);
      setMessage("Đã gửi yêu cầu chỉnh sửa. Chờ quản lý đào tạo duyệt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(fieldKey: string, fileList: FileList | null) {
    if (!fileList?.length || !student) return;
    const existing = documents[fieldKey]?.files || [];
    const room = 2 - existing.length;
    if (room <= 0) {
      setError("Mỗi trường tối đa 2 file");
      return;
    }
    const files = Array.from(fileList).slice(0, room);
    setError("");
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of files) {
        const metaRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maSinhVien: student.maSinhVien,
            fieldKey,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });
        const meta = await metaRes.json();
        if (!metaRes.ok) throw new Error(meta.error || "Không tạo được URL upload");
        const put = await fetch(meta.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload thất bại: ${file.name}`);
        uploaded.push({
          key: meta.key,
          name: meta.name,
          size: meta.size,
          contentType: meta.contentType,
          uploadedAt: meta.uploadedAt,
        });
      }
      setDocuments((prev) => ({
        ...prev,
        [fieldKey]: {
          status: "co_file",
          files: [...(prev[fieldKey]?.files || []), ...uploaded].slice(0, 2),
          note: prev[fieldKey]?.note,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi upload");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center text-foreground/70">
        Đang tải hồ sơ…
      </main>
    );
  }

  if (!student) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-destructive">{error || "Không có dữ liệu"}</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-2 text-primary">
          <ArrowLeft /> Quay lại tìm kiếm
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background pb-28">
      <header className="border-b border-border bg-gradient-to-r from-hero-from to-hero-to text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Image
            src="/logo-vietmy.png"
            alt="Cao Đẳng Việt Mỹ - Hà Nội"
            width={140}
            height={80}
            className="h-12 w-auto object-contain sm:h-14"
          />
          <Image
            src="/mascot-lyon.jpg"
            alt=""
            width={72}
            height={72}
            className="h-12 w-12 rounded-full object-cover object-top ring-2 ring-white/40 sm:h-14 sm:w-14"
            aria-hidden
          />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={18} /> Tìm lại
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="bg-primary px-4 py-4 text-on-primary">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">
                Hồ sơ sinh viên
              </p>
              <h1 className="font-display mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
                {student.hoVaTen}
              </h1>
              <p className="mt-1 font-mono text-sm text-white/80">
                Mã SV: {student.maSinhVien}
              </p>
            </div>
            {pending ? (
              <span className="inline-flex items-center rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">
                Đang chờ duyệt
              </span>
            ) : null}
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <tbody>
            <SummaryRow label="SĐT" value={String(student.soDienThoai || "")} />
            <SummaryRow label="Email cá nhân" value={String(student.emailCaNhan || "")} />
            <SummaryRow label="CCCD" value={String(student.canCuoc || "")} />
            <SummaryRow label="Lớp" value={String(student.lop || "")} />
            <SummaryRow label="Ngành" value={String(student.nganh || "")} last />
          </tbody>
        </table>
      </div>

      {message ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          <CheckCircle weight="fill" /> {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-accent-soft px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-sm text-foreground/65">
        Rà soát và chỉnh sửa bên dưới nếu sai. Mã sinh viên không thay đổi được.
      </p>

      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="font-display text-lg font-extrabold text-primary">{group.title}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {group.keys.map((key) => (
                <label key={key} className="block text-sm">
                  <span className="font-semibold text-foreground/75">
                    {FIELD_LABELS[key] || key}
                  </span>
                  <input
                    className="mt-1 min-h-12 w-full rounded-xl border border-border bg-white px-3 text-base"
                    value={fields[key] || ""}
                    onChange={(e) =>
                      setFields((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-extrabold text-primary">
            Giấy tờ / tệp đính kèm
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            Tối đa 2 file/trường, PDF hoặc ảnh, mỗi file ≤ 15MB. File chỉ hiện
            chính thức sau khi admin duyệt.
          </p>
          <div className="mt-4 space-y-3">
            {Object.entries(DOCUMENT_LABELS).map(([key, label]) => {
              const slot = documents[key] || { status: "thieu", files: [] };
              const official = student.documents?.[key]?.files || [];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-border/80 bg-muted/40 p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-xs text-foreground/60">
                        Trạng thái: {statusLabel(slot.status)}
                      </p>
                    </div>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold">
                      <FileArrowUp size={18} />
                      Upload
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          void uploadFiles(key, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {slot.files?.length ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {slot.files.map((f) => (
                        <li key={f.key} className="truncate text-foreground/80">
                          (chờ duyệt) {f.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {official.length ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {official.map((f) => (
                        <li key={f.key}>
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => void downloadFile(f.key)}
                          >
                            {f.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur safe-area-pb">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 font-bold text-white shadow-lg shadow-accent/20 disabled:opacity-50 sm:w-auto"
          >
            <FloppyDisk size={20} weight="bold" />
            {saving ? "Đang gửi…" : "Gửi yêu cầu chỉnh sửa"}
          </button>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <tr className={last ? "" : "border-b border-border/80"}>
      <th
        scope="row"
        className="w-[34%] bg-muted/40 px-3 py-2.5 align-top text-xs font-semibold uppercase tracking-wide text-foreground/55 sm:w-36"
      >
        {label}
      </th>
      <td className="px-3 py-2.5 text-[15px] font-semibold leading-snug break-all">
        {value || "—"}
      </td>
    </tr>
  );
}

async function downloadFile(key: string) {
  const res = await fetch(`/api/download?key=${encodeURIComponent(key)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không tải được");
  window.open(data.url, "_blank", "noopener,noreferrer");
}

function statusLabel(status: string) {
  if (status === "du") return "Đủ";
  if (status === "co_file") return "Có file";
  return "Thiếu";
}

function fieldGroups() {
  return [
    {
      title: "Thông tin cá nhân",
      keys: [
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
      keys: [
        "hoTenCha",
        "sdtCha",
        "hoTenMe",
        "sdtMe",
        "nguoiGiamHo",
        "sdtNguoiGiamHo",
      ],
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
        "ngay",
        "thang",
        "nam",
      ],
    },
  ] as const;
}
