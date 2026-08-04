"use client";

import { MagnifyingGlass, Student, SealCheck, Sparkle } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { StudentIdentity } from "@/lib/types";

const easeOut = [0.22, 1, 0.36, 1] as const;

const LYON_LINES = [
  "Chào bạn",
  "Hãy cùng một hành trình mới",
  "Tôi là Lyon",
  "Chào mừng bạn gia nhập Việt Mỹ",
];

export default function HomePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StudentIdentity[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StudentIdentity | null>(null);
  const [verifying, setVerifying] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setIntroDone(true);
      return;
    }
    const t = window.setTimeout(() => setIntroDone(true), 1600);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpenSuggest(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      setOpenSuggest(false);
      return;
    }

    setSuggestLoading(true);
    debounceRef.current = setTimeout(() => {
      void runSuggest(q);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function runSuggest(q: string) {
    const id = ++reqIdRef.current;
    try {
      const res = await fetch("/api/student/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 8 }),
      });
      const data = await res.json();
      if (id !== reqIdRef.current) return;
      if (!res.ok) {
        if (res.status === 429 || res.status === 503) {
          const detail =
            typeof data.detail === "string" && data.detail
              ? ` (${data.detail})`
              : "";
          const project =
            typeof data.projectId === "string" && data.projectId
              ? ` [project: ${data.projectId}]`
              : "";
          throw new Error(
            (data.error ||
              "Hệ thống đang bận. Vui lòng chờ một chút rồi thử lại.") +
              detail +
              project
          );
        }
        throw new Error(data.error || "Tìm kiếm thất bại");
      }
      setSuggestions(data.matches || []);
      setOpenSuggest(true);
      setError("");
    } catch (err) {
      if (id !== reqIdRef.current) return;
      setSuggestions([]);
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      if (id === reqIdRef.current) setSuggestLoading(false);
    }
  }

  function pickStudent(item: StudentIdentity) {
    setSelected(item);
    setQuery(item.hoVaTen);
    setOpenSuggest(false);
    setSuggestions([]);
    setError("");
    requestAnimationFrame(() => {
      document.getElementById("ket-qua")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    void runSuggest(q).then(() => {
      setOpenSuggest(true);
    });
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
                className="h-auto w-[min(55vw,200px)] drop-shadow-2xl"
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
      <section className="relative isolate overflow-x-hidden bg-gradient-to-b from-hero-from via-hero-to to-[#1a4a8a] text-white">
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
            className="relative z-30 flex flex-col items-center text-center lg:items-start lg:pb-12 lg:text-left"
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
                className="h-auto w-[min(48vw,168px)] object-contain drop-shadow-lg sm:w-[min(56vw,220px)] lg:w-[280px]"
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

            <motion.form
              onSubmit={onSearch}
              className="relative z-40 mt-5 w-full max-w-md rounded-2xl bg-white p-3 shadow-xl shadow-black/25 sm:p-4"
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={introDone ? { opacity: 1, y: 0, scale: 1 } : undefined}
              transition={{ duration: 0.5, ease: easeOut, delay: 0.32 }}
            >
              <label htmlFor="query" className="sr-only">
                Tìm kiếm hồ sơ
              </label>
              <div ref={wrapRef} className="relative flex flex-col gap-2">
                <div className="relative">
                  <input
                    id="query"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(null);
                    }}
                    onFocus={() => {
                      if (suggestions.length) setOpenSuggest(true);
                    }}
                    placeholder="Họ tên / email / SĐT / CCCD"
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-4 pr-11 text-base text-foreground placeholder:text-foreground/40"
                    autoComplete="off"
                    inputMode="search"
                    role="combobox"
                    aria-expanded={openSuggest}
                    aria-controls="search-suggest"
                    aria-autocomplete="list"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40">
                    {suggestLoading ? (
                      <motion.span
                        className="inline-block h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <MagnifyingGlass size={18} weight="bold" aria-hidden />
                    )}
                  </span>

                  <AnimatePresence>
                    {openSuggest && query.trim().length >= 2 ? (
                      <motion.ul
                        id="search-suggest"
                        role="listbox"
                        className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-auto rounded-xl border border-border bg-white py-1 shadow-2xl shadow-black/25"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                      >
                        {suggestions.length === 0 && !suggestLoading ? (
                          <li className="px-3 py-3 text-sm text-foreground/55">
                            Không tìm thấy hồ sơ phù hợp
                          </li>
                        ) : (
                          suggestions.map((m) => (
                            <li key={m.maSinhVien} role="option" aria-selected={selected?.maSinhVien === m.maSinhVien}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickStudent(m)}
                                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition hover:bg-muted/80 active:bg-accent-soft"
                              >
                                <span className="flex items-center gap-2 font-semibold text-foreground">
                                  <Student size={16} className="shrink-0 text-primary" aria-hidden />
                                  {m.hoVaTen || "—"}
                                </span>
                                <span className="grid gap-0.5 pl-6 font-mono text-[11px] leading-snug text-foreground/60 sm:text-xs">
                                  <span>Mã SV: {m.maSinhVien || "—"}</span>
                                  <span>SĐT: {m.soDienThoai || "—"}</span>
                                  <span>CCCD: {m.canCuoc || "—"}</span>
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </motion.ul>
                    ) : null}
                  </AnimatePresence>
                </div>

                <motion.button
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-bold text-white"
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  whileHover={reduceMotion ? undefined : { scale: 1.02, filter: "brightness(1.08)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <MagnifyingGlass size={20} weight="bold" aria-hidden />
                  Tìm hồ sơ của tôi
                </motion.button>
              </div>
            </motion.form>
          </motion.div>

          <div
            className={`relative z-0 mx-auto w-full max-w-sm transition-opacity duration-200 lg:max-w-none ${
              openSuggest && query.trim().length >= 2
                ? "pointer-events-none opacity-40 lg:pointer-events-auto lg:opacity-100"
                : ""
            }`}
            aria-hidden={
              openSuggest && query.trim().length >= 2 ? true : undefined
            }
          >
            <motion.div
              className="relative flex w-full justify-center lg:justify-end"
              initial={reduceMotion ? false : { opacity: 0, x: 40, scale: 0.9 }}
              animate={introDone ? { opacity: 1, x: 0, scale: 1 } : undefined}
              transition={{ duration: 0.65, ease: easeOut, delay: 0.28 }}
            >
              <motion.div
                className="relative z-0 w-[min(78vw,320px)] lg:w-[380px]"
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
                <LyonSpeech reduceMotion={!!reduceMotion} ready={introDone} />
              </motion.div>
            </motion.div>
          </div>
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
          {selected ? (
            <motion.section
              id="ket-qua"
              className="mt-4 space-y-4 scroll-mt-4"
              aria-live="polite"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <div className="flex items-center gap-2">
                <SealCheck size={22} weight="fill" className="text-accent" aria-hidden />
                <h2 className="font-display text-xl font-extrabold text-foreground">
                  Xác minh thông tin
                </h2>
              </div>

              <motion.div
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg shadow-primary/5"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <div className="border-b border-border bg-primary px-4 py-3 text-on-primary">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                    Hồ sơ đã chọn
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

function LyonSpeech({
  reduceMotion,
  ready,
}: {
  reduceMotion: boolean;
  ready: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!ready || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LYON_LINES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [ready, reduceMotion]);

  const text = reduceMotion ? LYON_LINES[0] : LYON_LINES[index];

  return (
    <div className="pointer-events-none absolute -left-1 right-2 top-4 sm:-left-3 sm:right-auto sm:top-6 sm:max-w-[220px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          className="relative inline-flex max-w-[min(78vw,220px)] items-start gap-1.5 rounded-2xl rounded-bl-md bg-white px-3 py-2 text-left text-xs font-bold leading-snug text-primary shadow-lg sm:text-sm"
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.35, ease: easeOut }}
        >
          <Sparkle weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>{text}</span>
          <span
            className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 bg-white shadow-sm"
            aria-hidden
          />
        </motion.div>
      </AnimatePresence>
    </div>
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
