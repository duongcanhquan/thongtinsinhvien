# Thông tin sinh viên Implementation Plan

> **For agentic workers:** Execute task-by-task. Checkboxes track progress. Prefer inline execution (user requested triển khai ngay).

**Goal:** Xây web tra cứu hồ sơ SV + yêu cầu sửa (pending) + admin duyệt/import Excel + upload R2 trên Vercel/Firestore.

**Architecture:** Next.js App Router; API + Firebase Admin only; httpOnly sessions; Cloudflare R2 signed URLs.

**Tech Stack:** Next.js 15+, TypeScript, Tailwind, firebase-admin, @aws-sdk/client-s3 (R2), xlsx, jose/iron-session hoặc signed cookies, Phosphor icons.

## Global Constraints

- Deploy Vercel only; no local-run requirement
- Student: 1-of-4 search → show 4 identity fields → confirm session
- Editable: all fields except `maSinhVien`
- Pending overwrite; session 2–4h + IP rate-limit
- Upload: max 2 files/field, pdf/image, ≤15MB; R2; admin download; SV sees files after approve
- Excel from row 3; skip existing `maSinhVien`
- Admin: `/admin` + `ADMIN_PASSWORD`
- Follow `design-system/thong-tin-sinh-vien/MASTER.md`
- Do not commit secrets; no commit unless user asks

## File map

- `src/lib/firebase-admin.ts` — Admin SDK
- `src/lib/session.ts` — student/admin cookies
- `src/lib/rate-limit.ts` — IP limits
- `src/lib/student-fields.ts` — Excel column ↔ field map
- `src/lib/r2.ts` — signed upload/download
- `src/lib/types.ts` — Student, ChangeRequest, DocumentMeta
- `src/app/api/**` — route handlers
- `src/app/(student)/**` — student UI
- `src/app/admin/**` — admin UI
- `src/components/**` — shared UI

---

### Task 1: Scaffold Next.js + design tokens

- [ ] Create Next.js app (TS, App Router, Tailwind, src/)
- [ ] Install: firebase-admin, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, xlsx, jose, @phosphor-icons/react
- [ ] Wire CSS variables from MASTER.md; fonts Fira Sans/Code
- [ ] Update `.env.example` with all server vars

### Task 2: Core domain + sessions

- [ ] `types.ts`, `student-fields.ts` (full column map)
- [ ] `firebase-admin.ts`, `session.ts`, `rate-limit.ts`, `r2.ts`
- [ ] Helpers: normalize phone/CCCD/email/name for search

### Task 3: Student APIs + UI

- [ ] `POST /api/student/search` — 1 query → match → return 4 identity fields (+ maSinhVien masked until confirm)
- [ ] `POST /api/student/verify` — confirm → set student session
- [ ] `GET /api/student/me` — profile + pending
- [ ] `POST /api/student/change-request` — overwrite pending
- [ ] `POST /api/student/upload-url` — signed put
- [ ] Pages: `/`, verify panel, `/ho-so`

### Task 4: Admin APIs + UI

- [ ] `POST /api/admin/login`, `POST /api/admin/logout`
- [ ] `GET /api/admin/requests`, `POST /api/admin/requests/[id]/decide`
- [ ] `GET /api/admin/students`, `PATCH /api/admin/students/[id]`
- [ ] `GET /api/admin/download` — signed get
- [ ] Pages: `/admin`, queue, student detail/edit

### Task 5: Excel import + polish

- [ ] `POST /api/admin/import` — parse from row 3, skip existing
- [ ] Import UI with summary (added/skipped/errors)
- [ ] Empty/loading/error states; a11y basics

### Task 6: Push readiness

- [ ] README: env vars Vercel + Firestore indexes note
- [ ] Ensure `.gitignore` covers secrets
