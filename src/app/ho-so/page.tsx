"use client";

import {
  ArrowLeft,
  CheckCircle,
  FileArrowUp,
  FloppyDisk,
  SealCheck,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
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

export default function HoSoPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [pending, setPending] = useState<ChangeRequest | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<Record<string, DocumentSlot>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
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

  const isDirty = useMemo(() => {
    if (!student) return false;
    for (const key of STUDENT_EDITABLE_FIELDS) {
      const next = String(fields[key] ?? "");
      const prev = String((student as Record<string, unknown>)[key] ?? "");
      if (next !== prev) return true;
    }
    for (const key of Object.keys(DOCUMENT_LABELS)) {
      const curr = student.documents?.[key];
      const next = documents[key];
      const currKeys = (curr?.files || []).map((f) => f.key).join("|");
      const nextKeys = (next?.files || []).map((f) => f.key).join("|");
      if (currKeys !== nextKeys) return true;
      if ((next?.status || "") !== (curr?.status || "")) return true;
      if ((next?.note || "") !== (curr?.note || "")) return true;
    }
    return false;
  }, [student, fields, documents]);

  async function submitRequest(intent: "edit" | "confirm") {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      let payload = { ...fields };
      const normalized = normalizeBirthDate(payload.ngaySinh);
      if (isValidBirthDate(normalized)) {
        const [dd, mm, yyyy] = normalized.split("/");
        payload = {
          ...payload,
          ngaySinh: normalized,
          ngay: String(Number(dd)),
          thang: String(Number(mm)),
          nam: yyyy,
        };
      } else if (payload.ngay || payload.thang || payload.nam) {
        const composed = birthDateFromParts(payload.ngay, payload.thang, payload.nam);
        if (composed) payload.ngaySinh = composed;
      }

      const invalid = validateProfileFields(payload);
      if (invalid) throw new Error(invalid);

      setFields(payload);

      const res = await fetch("/api/student/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          proposedFields: payload,
          proposedDocuments: documents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi yêu cầu thất bại");
      setPending(data.request);
      if (data.intent === "confirm") {
        setMessage("Đã xác nhận hồ sơ đúng. Cảm ơn bạn!");
      } else if (intent === "confirm" && data.hasChanges) {
        setMessage(
          "Phát hiện thay đổi so với bản gốc — đã gửi yêu cầu chỉnh sửa để quản lý duyệt."
        );
      } else {
        setMessage("Đã gửi yêu cầu chỉnh sửa. Chờ quản lý đào tạo duyệt.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(fieldKey: string, fileList: FileList | null) {
    if (!fileList?.length || !student) return;

    const official = student.documents?.[fieldKey];
    const officialStatus = official?.status || "thieu";
    if (officialStatus === "du") {
      setError("Mục này đã đủ — không cần bổ sung. Liên hệ quản lý nếu cần thay đổi.");
      return;
    }

    const draft = documents[fieldKey];
    const existing = draft?.files || [];
    const room = Math.max(0, 2 - existing.length);
    const incoming = Array.from(fileList).slice(0, room || 2);
    if (!incoming.length) {
      setError("Đã đủ tối đa 2 file cho mục này.");
      return;
    }

    setUploadingKey(fieldKey);
    setError("");
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of incoming) {
        const contentType =
          file.type ||
          guessClientContentType(file.name) ||
          "application/octet-stream";

        const metaRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maSinhVien: student.maSinhVien,
            fieldKey,
            filename: file.name,
            contentType,
            size: file.size,
          }),
        });
        const meta = await metaRes.json();
        if (!metaRes.ok) {
          throw new Error(meta.error || "Không tạo được URL upload");
        }

        const put = await fetch(meta.url, {
          method: "PUT",
          headers: { "Content-Type": meta.contentType || contentType },
          body: file,
        });
        if (!put.ok) {
          throw new Error(`Tải file thất bại: ${file.name} (${put.status})`);
        }

        uploaded.push({
          key: meta.key,
          name: meta.name,
          size: meta.size,
          contentType: meta.contentType || contentType,
          uploadedAt: meta.uploadedAt,
        });
      }

      setDocuments((prev) => {
        const prevFiles = prev[fieldKey]?.files || [];
        const nextFiles = [...prevFiles, ...uploaded].slice(0, 2);
        return {
          ...prev,
          [fieldKey]: {
            status: "co_file",
            files: nextFiles,
            note: prev[fieldKey]?.note,
          },
        };
      });
      setMessage("Đã bổ sung file (chờ gửi yêu cầu để admin duyệt).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi upload");
    } finally {
      setUploadingKey(null);
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
    <main className="min-h-dvh bg-background pb-36">
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
                  {pending.intent === "confirm"
                    ? "Đã gửi xác nhận"
                    : "Đang chờ duyệt"}
                </span>
              ) : null}
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              <SummaryRow label="SĐT" value={String(student.soDienThoai || "")} />
              <SummaryRow
                label="Email cá nhân"
                value={String(student.emailCaNhan || "")}
              />
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
          <p
            className="mt-4 rounded-xl border border-destructive/30 bg-accent-soft px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-foreground/65">
          Rà soát và chỉnh sửa bên dưới nếu sai. Mã sinh viên không thay đổi được.
        </p>

        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section
              key={group.title}
              className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
            >
              <h2 className="font-display text-lg font-extrabold text-primary">
                {group.title}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
                {group.keys.map((key) => {
                  if (key === "ngaySinh") {
                    return (
                      <BirthDateFields
                        key={key}
                        ngaySinh={fields.ngaySinh || ""}
                        ngay={fields.ngay || ""}
                        thang={fields.thang || ""}
                        nam={fields.nam || ""}
                        onChange={(next) =>
                          setFields((prev) => ({ ...prev, ...next }))
                        }
                      />
                    );
                  }
                  if (isPhoneKey(key)) {
                    return (
                      <PhoneField
                        key={key}
                        label={FIELD_LABELS[key] || key}
                        value={fields[key] || ""}
                        onChange={(v) =>
                          setFields((prev) => ({ ...prev, [key]: v }))
                        }
                      />
                    );
                  }
                  return (
                    <label key={key} className="block text-sm">
                      <span className="font-semibold text-foreground/75">
                        {FIELD_LABELS[key] || key}
                      </span>
                      <input
                        className="mt-1 min-h-12 w-full rounded-xl border border-border bg-white px-3 text-base"
                        value={fields[key] || ""}
                        onChange={(e) =>
                          setFields((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="font-display text-lg font-extrabold text-primary">
              Giấy tờ / tệp đính kèm
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              <span className="font-semibold text-emerald-700">Xanh = Đủ</span>{" "}
              (không cần nộp thêm).{" "}
              <span className="font-semibold text-destructive">Đỏ = Thiếu</span>{" "}
              — bấm <strong>Bổ sung</strong> để tải file. Tối đa 2 file/trường,
              PDF hoặc ảnh ≤ 15MB. File mới chỉ chính thức sau khi admin duyệt.
            </p>
            <div className="mt-4 space-y-3">
              {Object.entries(DOCUMENT_LABELS).map(([key, label]) => {
                const officialSlot = student.documents?.[key];
                const officialStatus = officialSlot?.status || "thieu";
                const isDu = officialStatus === "du";
                const isThieu = officialStatus === "thieu";
                const slot = documents[key] || {
                  status: "thieu" as const,
                  files: [],
                };
                const official = officialSlot?.files || [];
                const officialKeys = new Set(official.map((f) => f.key));
                const pendingFiles = (slot.files || []).filter(
                  (f) => !officialKeys.has(f.key)
                );
                const busy = uploadingKey === key;
                const canUpload = !isDu;
                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-3 sm:p-4 ${
                      isDu
                        ? "border-emerald-200 bg-emerald-50/80"
                        : isThieu
                          ? "border-destructive/25 bg-red-50/70"
                          : "border-amber-200 bg-amber-50/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{label}</p>
                        <StatusBadge status={officialStatus} />
                      </div>
                      {canUpload ? (
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50">
                          <FileArrowUp size={18} />
                          {busy ? "Đang tải…" : "Bổ sung"}
                          <input
                            type="file"
                            accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                            multiple
                            disabled={busy || saving}
                            className="sr-only"
                            onChange={(e) => {
                              void uploadFiles(key, e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : (
                        <span className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white">
                          Đã đủ
                        </span>
                      )}
                    </div>
                    {pendingFiles.length ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {pendingFiles.map((f) => (
                          <li key={f.key} className="truncate text-amber-900">
                            (chờ admin duyệt) {f.name}
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void submitRequest("edit")}
            disabled={saving || !isDirty}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-bold text-white shadow-lg shadow-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <FloppyDisk size={20} weight="bold" />
            {saving ? "Đang gửi…" : "Gửi yêu cầu chỉnh sửa"}
          </button>
          <button
            type="button"
            onClick={() => void submitRequest("confirm")}
            disabled={saving}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-on-primary disabled:opacity-50"
          >
            <SealCheck size={20} weight="fill" />
            {saving ? "Đang gửi…" : "Xác nhận đúng"}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-4xl text-center text-[11px] text-foreground/50">
          Nếu đã sửa nhưng bấm nhầm “Xác nhận đúng”, hệ thống vẫn gửi yêu cầu
          chỉnh sửa so với bản gốc.
        </p>
      </div>
    </main>
  );
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

function StatusBadge({ status }: { status: string }) {
  if (status === "du") {
    return (
      <span className="mt-1 inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
        Đủ
      </span>
    );
  }
  if (status === "co_file") {
    return (
      <span className="mt-1 inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
        Có file (chờ xử lý)
      </span>
    );
  }
  return (
    <span className="mt-1 inline-flex items-center rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold text-white">
      Thiếu — cần bổ sung
    </span>
  );
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
      ],
    },
  ] as const;
}
