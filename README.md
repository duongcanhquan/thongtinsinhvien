# Thông tin sinh viên

Hệ thống tra cứu / rà soát hồ sơ sinh viên + admin QLĐT duyệt chỉnh sửa, import Excel, lưu file trên Cloudflare R2.

## Stack

- Next.js (App Router) trên Vercel
- Firestore (Firebase Admin SDK, server-only)
- Cloudflare R2 (upload/download signed URL)

## Biến môi trường (Vercel)

Bắt buộc:

- `FIREBASE_SERVICE_ACCOUNT_KEY` — toàn bộ JSON service account
- `SESSION_SECRET` — chuỗi ngẫu nhiên dài
- `ADMIN_PASSWORD` — mật khẩu `/admin` (vd. `admin123`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

Tuỳ chọn:

- `STUDENT_SESSION_HOURS` (mặc định `4`)
- `R2_PUBLIC_BASE_URL`
- Các `NEXT_PUBLIC_FIREBASE_*` (không bắt buộc cho luồng API hiện tại)

## Chạy build

```bash
npm install
npm run build
```

## Luồng chính

- SV: `/` tìm 1 trường → hiện 4 định danh → xác nhận → `/ho-so`
- Admin: `/admin` → yêu cầu sửa / search-sửa / import Excel (dòng 3+)

## Design

`design-system/thong-tin-sinh-vien/MASTER.md`
