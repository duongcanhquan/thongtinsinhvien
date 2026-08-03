"use client";

import { MagnifyingGlass, Student, SealCheck } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { StudentIdentity } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<StudentIdentity[]>([]);
  const [selected, setSelected] = useState<StudentIdentity | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMatches([]);
    setSelected(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tìm kiếm thất bại");
      if (!data.matches?.length) {
        setError("Không tìm thấy hồ sơ phù hợp. Kiểm tra lại thông tin.");
      } else {
        setMatches(data.matches);
        if (data.matches.length === 1) setSelected(data.matches[0]);
        requestAnimationFrame(() => {
          document.getElementById("ket-qua")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm() {
    if (!selected) return;
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/student/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xác minh thất bại");
      router.push("/ho-so");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-background">
      {/* Hero — brand first, mobile-first */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-hero-from via-hero-to to-[#1a4a8a] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 45%), radial-gradient(circle at 80% 0%, rgba(200,16,46,0.25), transparent 40%)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto grid max-w-5xl gap-6 px-4 pb-8 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-10 lg:pb-0 lg:pt-10">
          <div className="animate-fade-up z-10 flex flex-col items-center text-center lg:items-start lg:pb-12 lg:text-left">
            <Image
              src="/logo-vietmy.png"
              alt="Cao Đẳng Việt Mỹ - Hà Nội"
              width={280}
              height={160}
              priority
              className="h-auto w-[min(72vw,280px)] object-contain drop-shadow-lg lg:w-[300px]"
            />
            <h1 className="font-display mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Tra cứu thông tin
              <span className="block text-white/95">sinh viên</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
              Nhập họ tên, email, SĐT hoặc CCCD để xem và rà soát hồ sơ của bạn.
            </p>

            <form
              onSubmit={onSearch}
              className="mt-6 w-full max-w-md rounded-2xl bg-white p-3 shadow-xl shadow-black/20 sm:p-4"
            >
              <label htmlFor="query" className="sr-only">
                Tìm kiếm hồ sơ
              </label>
              <div className="flex flex-col gap-2">
                <input
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Họ tên / email / SĐT / CCCD"
                  className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-foreground/40"
                  autoComplete="off"
                  inputMode="search"
                  required
                  minLength={3}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-bold text-white transition duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  <MagnifyingGlass size={20} weight="bold" aria-hidden />
                  {loading ? "Đang tìm…" : "Tìm hồ sơ của tôi"}
                </button>
              </div>
              <p className="mt-2 text-left text-xs leading-snug text-foreground/55">
                Chỉ cần một thông tin — hệ thống hiện đủ 4 trường để bạn xác nhận.
              </p>
            </form>
          </div>

          <div className="relative mx-auto flex w-full max-w-sm justify-center lg:max-w-none lg:justify-end">
            <div className="animate-mascot relative z-10 w-[min(78vw,320px)] lg:w-[380px]">
              <Image
                src="/mascot-lyon.jpg"
                alt="Linh vật sư tử Cao Đẳng Việt Mỹ"
                width={760}
                height={760}
                priority
                className="h-auto w-full rounded-[2rem] object-cover object-top shadow-2xl shadow-black/35 ring-4 ring-white/20"
              />
            </div>
          </div>
        </div>

        <div className="h-6 bg-gradient-to-b from-transparent to-background lg:h-10" />
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        {error ? (
          <p
            className="animate-fade-up -mt-2 rounded-2xl border border-destructive/25 bg-accent-soft px-4 py-3 text-sm font-medium text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {matches.length > 0 ? (
          <section
            id="ket-qua"
            className="animate-fade-up mt-4 space-y-4 scroll-mt-4"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <SealCheck size={22} weight="fill" className="text-accent" aria-hidden />
              <h2 className="font-display text-xl font-extrabold text-foreground">
                Xác minh thông tin
              </h2>
            </div>

            {matches.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm text-foreground/70">
                  Có nhiều kết quả — chọn đúng hồ sơ của bạn:
                </p>
                {matches.map((m) => (
                  <button
                    key={m.maSinhVien}
                    type="button"
                    onClick={() => setSelected(m)}
                    className={`flex w-full min-h-14 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 ${
                      selected?.maSinhVien === m.maSinhVien
                        ? "border-accent bg-accent-soft shadow-sm"
                        : "border-border bg-surface hover:border-secondary"
                    }`}
                  >
                    <Student size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    <span>
                      <span className="block font-semibold">{m.hoVaTen}</span>
                      <span className="font-mono text-xs text-foreground/55">
                        {m.maSinhVien}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {selected ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                <div className="border-b border-border bg-primary px-4 py-3 text-on-primary">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                    Hồ sơ khớp
                  </p>
                  <p className="font-display text-lg font-extrabold leading-tight">
                    {selected.hoVaTen}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-white/75">
                    Mã SV: {selected.maSinhVien}
                  </p>
                </div>

                {/* Mobile-first identity table */}
                <table className="w-full text-left text-sm">
                  <tbody>
                    <InfoRow label="Họ và tên" value={selected.hoVaTen} />
                    <InfoRow label="Email cá nhân" value={selected.emailCaNhan} />
                    <InfoRow label="Số điện thoại" value={selected.soDienThoai} />
                    <InfoRow label="Căn cước" value={selected.canCuoc} last />
                  </tbody>
                </table>

                <div className="border-t border-border p-4">
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={verifying}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-bold text-on-primary transition duration-200 hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
                  >
                    {verifying ? "Đang xác nhận…" : "Đúng là tôi — xem hồ sơ"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <footer className="mt-12 border-t border-border/70 pt-6 text-center text-xs text-foreground/45">
          <p>Thành viên Tập đoàn Giáo dục EQuest</p>
          <a
            href="/admin"
            className="mt-2 inline-block text-secondary underline-offset-2 hover:underline"
          >
            Dành cho quản lý đào tạo
          </a>
        </footer>
      </div>
    </main>
  );
}

function InfoRow({
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
        className="w-[38%] bg-muted/50 px-3 py-3 align-top text-xs font-semibold uppercase tracking-wide text-foreground/55 sm:w-40 sm:px-4"
      >
        {label}
      </th>
      <td className="px-3 py-3 text-[15px] font-semibold leading-snug break-all text-foreground sm:px-4 sm:text-base">
        {value || "—"}
      </td>
    </tr>
  );
}
