"use client";

import { MagnifyingGlass, Student, SealCheck, Sparkle } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { StudentIdentity } from "@/lib/types";

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function HomePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<StudentIdentity[]>([]);
  const [selected, setSelected] = useState<StudentIdentity | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setIntroDone(true);
      return;
    }
    const t = window.setTimeout(() => setIntroDone(true), 1600);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

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
            behavior: reduceMotion ? "auto" : "smooth",
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
    <main className="relative min-h-dvh overflow-x-hidden bg-background">
      {/* Opening portal */}
      <AnimatePresence>
        {!introDone ? (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-hero-from to-hero-to"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: easeOut } }}
            aria-hidden
          >
            <motion.div
              className="absolute inset-0 overflow-hidden"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="absolute -left-1/4 top-1/4 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
                animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl"
                animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <Image
                src="/logo-vietmy.png"
                alt=""
                width={260}
                height={150}
                priority
                className="h-auto w-[min(70vw,260px)] drop-shadow-2xl"
              />
            </motion.div>
            <motion.p
              className="font-display mt-6 text-lg font-extrabold tracking-wide text-white sm:text-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5, ease: easeOut }}
            >
              Tra cứu dữ liệu
            </motion.p>
            <motion.div
              className="mt-8 h-1 w-28 overflow-hidden rounded-full bg-white/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.55, duration: 0.9, ease: easeOut }}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-hero-from via-hero-to to-[#1a4a8a] text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.2), transparent 42%), radial-gradient(circle at 82% 8%, rgba(200,16,46,0.28), transparent 38%)",
            }}
          />
          {!reduceMotion ? (
            <>
              <motion.div
                className="absolute left-[10%] top-[18%] h-40 w-40 rounded-full bg-white/10 blur-2xl"
                animate={{ y: [0, -18, 0], opacity: [0.35, 0.55, 0.35] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute right-[8%] top-[40%] h-52 w-52 rounded-full bg-accent/25 blur-3xl"
                animate={{ y: [0, 22, 0], x: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
              <SparklesField />
            </>
          ) : null}
        </div>

        <div className="relative mx-auto grid max-w-5xl gap-6 px-4 pb-8 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-10 lg:pb-0 lg:pt-10">
          <motion.div
            className="z-10 flex flex-col items-center text-center lg:items-start lg:pb-12 lg:text-left"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={introDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
            transition={{ duration: 0.55, ease: easeOut, delay: reduceMotion ? 0 : 0.05 }}
          >
            <motion.div
              initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
              animate={introDone ? { scale: 1, opacity: 1 } : undefined}
              transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.1 }}
            >
              <Image
                src="/logo-vietmy.png"
                alt="Cao Đẳng Việt Mỹ - Hà Nội"
                width={280}
                height={160}
                priority
                className="h-auto w-[min(72vw,280px)] object-contain drop-shadow-lg lg:w-[300px]"
              />
            </motion.div>

            <motion.h1
              className="font-display mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={introDone ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.5, ease: easeOut, delay: 0.22 }}
            >
              Tra cứu dữ liệu
            </motion.h1>

            <motion.p
              className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={introDone ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.45, ease: easeOut, delay: 0.32 }}
            >
              Nhập họ tên, email, SĐT hoặc CCCD để xem và rà soát hồ sơ của bạn.
            </motion.p>

            <motion.form
              onSubmit={onSearch}
              className="mt-6 w-full max-w-md rounded-2xl bg-white p-3 shadow-xl shadow-black/25 sm:p-4"
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={introDone ? { opacity: 1, y: 0, scale: 1 } : undefined}
              transition={{ duration: 0.5, ease: easeOut, delay: 0.4 }}
              whileHover={reduceMotion ? undefined : { y: -2 }}
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
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-bold text-white disabled:opacity-50"
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  whileHover={reduceMotion ? undefined : { scale: 1.02, filter: "brightness(1.08)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <MagnifyingGlass size={20} weight="bold" aria-hidden />
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.span
                        className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                      />
                      Đang tìm…
                    </span>
                  ) : (
                    "Tìm hồ sơ của tôi"
                  )}
                </motion.button>
              </div>
            </motion.form>
          </motion.div>

          <motion.div
            className="relative mx-auto flex w-full max-w-sm justify-center lg:max-w-none lg:justify-end"
            initial={reduceMotion ? false : { opacity: 0, x: 40, scale: 0.9 }}
            animate={introDone ? { opacity: 1, x: 0, scale: 1 } : undefined}
            transition={{ duration: 0.65, ease: easeOut, delay: 0.28 }}
          >
            <motion.div
              className="relative z-10 w-[min(78vw,320px)] lg:w-[380px]"
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -10, 0], rotate: [0, 0.6, 0, -0.6, 0] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <motion.div
                className="absolute -inset-3 rounded-[2.2rem] bg-gradient-to-tr from-accent/40 via-white/10 to-sky-300/30 blur-md"
                animate={reduceMotion ? undefined : { opacity: [0.45, 0.8, 0.45] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
              <Image
                src="/mascot-lyon.jpg"
                alt="Linh vật sư tử Cao Đẳng Việt Mỹ"
                width={760}
                height={760}
                priority
                className="relative h-auto w-full rounded-[2rem] object-cover object-top shadow-2xl shadow-black/40 ring-4 ring-white/25"
              />
              <motion.div
                className="absolute -left-2 top-6 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary shadow-lg"
                initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                animate={introDone ? { scale: 1, opacity: 1 } : undefined}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.7 }}
              >
                <span className="inline-flex items-center gap-1">
                  <Sparkle weight="fill" className="text-accent" /> Xin chào!
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        <div className="h-6 bg-gradient-to-b from-transparent to-background lg:h-10" />
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="error"
              className="-mt-2 rounded-2xl border border-destructive/25 bg-accent-soft px-4 py-3 text-sm font-medium text-destructive"
              role="alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {matches.length > 0 ? (
            <motion.section
              id="ket-qua"
              className="mt-4 space-y-4 scroll-mt-4"
              aria-live="polite"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
              >
                <motion.span
                  animate={reduceMotion ? undefined : { rotate: [0, -12, 12, 0] }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <SealCheck size={22} weight="fill" className="text-accent" aria-hidden />
                </motion.span>
                <h2 className="font-display text-xl font-extrabold text-foreground">
                  Xác minh thông tin
                </h2>
              </motion.div>

              {matches.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground/70">
                    Có nhiều kết quả — chọn đúng hồ sơ của bạn:
                  </p>
                  {matches.map((m, i) => (
                    <motion.button
                      key={m.maSinhVien}
                      type="button"
                      onClick={() => setSelected(m)}
                      className={`flex w-full min-h-14 items-start gap-3 rounded-2xl border px-4 py-3 text-left ${
                        selected?.maSinhVien === m.maSinhVien
                          ? "border-accent bg-accent-soft shadow-sm"
                          : "border-border bg-surface"
                      }`}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.08 + i * 0.05, duration: 0.3, ease: easeOut }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    >
                      <Student size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      <span>
                        <span className="block font-semibold">{m.hoVaTen}</span>
                        <span className="font-mono text-xs text-foreground/55">
                          {m.maSinhVien}
                        </span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              ) : null}

              {selected ? (
                <motion.div
                  className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg shadow-primary/5"
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
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

                  <table className="w-full text-left text-sm">
                    <tbody>
                      {[
                        ["Họ và tên", selected.hoVaTen],
                        ["Email cá nhân", selected.emailCaNhan],
                        ["Số điện thoại", selected.soDienThoai],
                        ["Căn cước", selected.canCuoc],
                      ].map(([label, value], i, arr) => (
                        <motion.tr
                          key={label}
                          className={i === arr.length - 1 ? "" : "border-b border-border/80"}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 + i * 0.06, duration: 0.28 }}
                        >
                          <th
                            scope="row"
                            className="w-[38%] bg-muted/50 px-3 py-3 align-top text-xs font-semibold uppercase tracking-wide text-foreground/55 sm:w-40 sm:px-4"
                          >
                            {label}
                          </th>
                          <td className="px-3 py-3 text-[15px] font-semibold leading-snug break-all text-foreground sm:px-4 sm:text-base">
                            {value || "—"}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-border p-4">
                    <motion.button
                      type="button"
                      onClick={onConfirm}
                      disabled={verifying}
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-bold text-on-primary disabled:opacity-50"
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                    >
                      {verifying ? "Đang xác nhận…" : "Đúng là tôi — xem hồ sơ"}
                    </motion.button>
                  </div>
                </motion.div>
              ) : null}
            </motion.section>
          ) : null}
        </AnimatePresence>

        <footer className="mt-12 border-t border-border/70 pt-6 text-center text-xs text-foreground/45">
          <p>Thành viên Tập đoàn Giáo dục EQuest</p>
        </footer>
      </div>
    </main>
  );
}

function SparklesField() {
  const dots = [
    { left: "12%", top: "30%", delay: 0 },
    { left: "28%", top: "12%", delay: 0.4 },
    { left: "70%", top: "22%", delay: 0.8 },
    { left: "85%", top: "55%", delay: 0.2 },
    { left: "55%", top: "8%", delay: 1.1 },
  ];
  return (
    <>
      {dots.map((d) => (
        <motion.span
          key={`${d.left}-${d.top}`}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/70"
          style={{ left: d.left, top: d.top }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: d.delay,
          }}
        />
      ))}
    </>
  );
}
