"use client";

import { MagnifyingGlass, Student } from "@phosphor-icons/react";
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
        setError("Không tìm thấy hồ sơ phù hợp.");
      } else {
        setMatches(data.matches);
        if (data.matches.length === 1) setSelected(data.matches[0]);
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-wide text-secondary">
          Hệ thống hồ sơ
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Thông tin sinh viên
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/80">
          Nhập họ tên, email cá nhân, số điện thoại hoặc căn cước để tra cứu và
          rà soát hồ sơ của bạn.
        </p>
      </header>

      <form
        onSubmit={onSearch}
        className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <label htmlFor="query" className="block text-sm font-medium">
          Tìm kiếm hồ sơ
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Họ tên / email / SĐT / CCCD"
            className="min-h-12 flex-1 rounded-xl border border-border bg-white px-4 text-base text-foreground placeholder:text-foreground/40"
            autoComplete="off"
            required
            minLength={3}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-50"
          >
            <MagnifyingGlass size={20} weight="bold" aria-hidden />
            {loading ? "Đang tìm…" : "Tìm kiếm"}
          </button>
        </div>
        <p className="mt-2 text-sm text-foreground/60">
          Chỉ cần một thông tin. Hệ thống sẽ hiện đủ 4 trường định danh để bạn
          xác nhận.
        </p>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {matches.length > 0 ? (
        <section className="mt-6 space-y-4" aria-live="polite">
          <h2 className="text-lg font-semibold">Xác minh thông tin</h2>
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
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    selected?.maSinhVien === m.maSinhVien
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-secondary"
                  }`}
                >
                  <Student size={22} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-medium">{m.hoVaTen}</span>
                    <span className="font-mono text-xs text-foreground/60">
                      {m.maSinhVien}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                <IdentityItem label="Họ và tên" value={selected.hoVaTen} />
                <IdentityItem label="Email cá nhân" value={selected.emailCaNhan} />
                <IdentityItem label="Số điện thoại" value={selected.soDienThoai} />
                <IdentityItem label="Căn cước" value={selected.canCuoc} />
              </dl>
              <button
                type="button"
                onClick={onConfirm}
                disabled={verifying}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
              >
                {verifying ? "Đang xác nhận…" : "Đúng là tôi — xem hồ sơ"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="mt-auto pt-12 text-center text-sm text-foreground/50">
        <a href="/admin" className="underline-offset-2 hover:underline">
          Dành cho quản lý đào tạo
        </a>
      </footer>
    </main>
  );
}

function IdentityItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-foreground/50">
        {label}
      </dt>
      <dd className="mt-1 break-all text-base font-medium">
        {value || "—"}
      </dd>
    </div>
  );
}
