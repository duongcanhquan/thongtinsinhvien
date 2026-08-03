# Thông tin sinh viên — Design Spec

**Date:** 2026-08-03  
**Status:** Approved for implementation  
**Deploy:** Vercel (production only)  
**Data:** Firestore + Cloudflare R2

## Goal

Hệ thống tra cứu / rà soát hồ sơ sinh viên; sinh viên yêu cầu chỉnh sửa (pending); admin QLĐT duyệt / từ chối / sửa; import Excel; upload giấy tờ lên R2.

## Actors

- **Sinh viên:** không account; tra cứu + phiên xác minh tạm
- **Admin:** `/admin` + mật khẩu cố định (`ADMIN_PASSWORD`, mặc định vận hành `admin123`)

## Architecture (Approach B)

Next.js App Router trên Vercel. Mọi đọc/ghi PII qua Route Handlers + Firebase Admin SDK. Cookie `httpOnly` cho phiên SV và admin. File trên Cloudflare R2 (signed upload/download).

## Student flows

1. Nhập **1 trong 4**: họ tên / email cá nhân / SĐT / CCCD
2. Hệ thống tìm và hiển thị **đồng bộ 4 trường định danh** của hồ sơ khớp
3. SV xác nhận → cookie phiên gắn `maSinhVien` (2–4 giờ) + rate-limit IP
4. Xem hồ sơ; yêu cầu sửa hầu hết trường **trừ mã sinh viên**
5. Request pending: **ghi đè** request cũ cùng SV
6. Upload: tối đa **2 file/trường**, pdf hoặc ảnh, **≤ 15MB/file** → R2
7. File pending: admin xem/tải; sau **approve** merge vào hồ sơ → SV thấy file đã valid
8. Không có file nhưng thông tin đủ → status `du`; vẫn cho upload bổ sung

## Admin flows

- Login `/admin`
- Hàng đợi change requests: duyệt / từ chối / sửa rồi duyệt; tải file SV
- Search + sửa trực tiếp hồ sơ; tải file
- Import Excel: data từ **dòng 3** (2 dòng đầu là thông tin); trùng mã SV → **cập nhật** trường từ Excel (giữ file đã upload)

## Excel columns (row 3+)

STT, Họ và tên, Họ và, Tên, Mã sinh viên, Giới tính, Ngày sinh, Ngày, Tháng, Năm, Số điện thoại, Email trường, Email cá nhân, Khu vực, Địa chỉ thường trú, Địa chỉ tạm trú/hiện tại, Hệ đào tạo, Khoa đào tạo, Ngành, Lớp, Lớp chủ nhiệm tháng 8 và tháng 9, Ghi chú xếp lớp, SV đã có laptop, Xếp lớp tin học, Khóa ban đầu, Khóa hiện tại, Nơi sinh, Dân tộc, Căn cước, Ngày nhập học, Tư vấn tuyển sinh, Cơ sở học, Họ tên cha, Sđt cha, Họ tên mẹ, Sđt mẹ, Người giám hộ, Sđt người giám hộ, Trường THPT, Tỉnh trường, Đối tượng, Điểm trung bình, Học bổng, ẢNH, Thông tin sai lệch, Máy tính học tập, Ghi chú hồ sơ, Phiếu đăng ký dự tuyển, Tờ khai sinh viên, CCCD, Giấy khai sinh, Chứng nhận hoàn thành THPT, Chứng nhận TN/kết quả thi THPT, Bằng THPT, Học bạ THPT, Bằng THCS, Học bạ THCS, Thông tin cư trú, Giấy khám sức khỏe, Ảnh thẻ

## Data model

- `students/{maSinhVien}` — hồ sơ chính thức + `documents`
- `changeRequests/{maSinhVien}` — tối đa 1 pending (overwrite)

## Security

- Không Firestore client cho PII
- `SESSION_SECRET`, `ADMIN_PASSWORD`, Firebase Admin, R2 credentials trên Vercel
- Rate-limit theo IP cho search/verify

## UI

Design system: `design-system/thong-tin-sinh-vien/MASTER.md` (ui-ux-pro-max). Institutional blue, Fira Sans/Code, SVG icons, mobile-first student / denser admin.

## Out of scope (MVP)

- Firebase Auth thật, OTP SMS, realtime websocket
- Multi-admin roles, audit UI đầy đủ (có thể log tối thiểu)
