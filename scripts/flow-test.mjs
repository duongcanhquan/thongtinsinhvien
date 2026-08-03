/**
 * End-to-end API flow test: search → verify → edit → pending → admin approve.
 * Usage: node scripts/flow-test.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:3000
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function jar() {
  const cookies = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      for (const line of raw) {
        const part = line.split(";")[0];
        const i = part.indexOf("=");
        if (i > 0) cookies.set(part.slice(0, i), part.slice(i + 1));
      }
      const single = res.headers.get("set-cookie");
      if (single && raw.length === 0) {
        const part = single.split(";")[0];
        const i = part.indexOf("=");
        if (i > 0) cookies.set(part.slice(0, i), part.slice(i + 1));
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function req(cookieJar, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const c = cookieJar.header();
  if (c) headers.cookie = c;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  cookieJar.store(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { res, json };
}

async function main() {
  console.log(`Testing against ${BASE}\n`);

  const studentJar = jar();
  const adminJar = jar();

  // Health
  try {
    const home = await fetch(BASE);
    if (home.ok) pass("GET /", `status ${home.status}`);
    else fail("GET /", `status ${home.status}`);
  } catch (e) {
    fail("GET /", e.message);
    printSummary();
    process.exit(1);
  }

  // Admin login
  {
    const { res, json } = await req(adminJar, "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    if (res.ok) pass("Admin login");
    else fail("Admin login", json?.error || res.status);
  }

  // List / search students
  let student = null;
  {
    const { res, json } = await req(adminJar, "/api/admin/students?q=");
    if (!res.ok) {
      fail("Admin list students", json?.error || res.status);
    } else {
      const list = json.students || [];
      if (list.length === 0) {
        fail("Admin list students", "Không có sinh viên — hãy import Excel trước");
      } else {
        student = list[0];
        pass("Admin list students", `${list.length} SV, dùng ${student.maSinhVien}`);
      }
    }
  }

  if (!student) {
    printSummary();
    process.exit(1);
  }

  const ma = student.maSinhVien;
  const originalPhone = String(student.soDienThoai || "");
  const testPhone = originalPhone.endsWith("9")
    ? `${originalPhone.slice(0, -1)}8`
    : `${originalPhone || "090000000"}9`;

  // Student search
  {
    const { res, json } = await req(studentJar, "/api/student/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ma }),
    });
    if (res.ok && (json.matches || json.results || []).some((r) => r.maSinhVien === ma)) {
      pass("Student search", ma);
    } else fail("Student search", json?.error || JSON.stringify(json));
  }

  // Verify → session (need identity match)
  {
    const { res, json } = await req(studentJar, "/api/student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maSinhVien: ma,
        hoVaTen: student.hoVaTen,
        emailCaNhan: student.emailCaNhan,
        soDienThoai: student.soDienThoai,
        canCuoc: student.canCuoc,
      }),
    });
    if (res.ok) pass("Student verify → session");
    else fail("Student verify", json?.error || res.status);
  }

  // me — official record
  let meBefore = null;
  {
    const { res, json } = await req(studentJar, "/api/student/me");
    if (res.ok) {
      meBefore = json.student;
      pass("Student me", `phone=${meBefore.soDienThoai}`);
    } else fail("Student me", json?.error || res.status);
  }

  // Change request: edit phone (should NOT write official yet)
  {
    const fields = { ...pickEditable(meBefore), soDienThoai: testPhone };
    const { res, json } = await req(studentJar, "/api/student/change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "edit",
        proposedFields: fields,
        proposedDocuments: meBefore.documents || {},
      }),
    });
    if (res.ok && json.intent === "edit" && json.hasChanges) {
      pass("Submit edit request", `proposed phone=${testPhone}`);
    } else fail("Submit edit request", JSON.stringify(json));
  }

  // Official still old
  {
    const { res, json } = await req(studentJar, "/api/student/me");
    if (res.ok && String(json.student.soDienThoai) === originalPhone) {
      pass("Official unchanged before approve", originalPhone || "(empty)");
    } else {
      fail(
        "Official unchanged before approve",
        `got ${json?.student?.soDienThoai}, expected ${originalPhone}`
      );
    }
    if (json?.pending?.status === "pending") pass("Pending visible to student");
    else fail("Pending visible to student", JSON.stringify(json?.pending));
  }

  // Admin sees queue
  {
    const { res, json } = await req(adminJar, "/api/admin/requests");
    const found = (json.requests || []).find((r) => r.maSinhVien === ma);
    if (res.ok && found) pass("Admin queue has request");
    else fail("Admin queue has request", json?.error || "not found");
  }

  // Upload URL + tiny PNG
  let uploadedKey = null;
  {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const tmp = join(tmpdir(), `flow-test-${Date.now()}.png`);
    writeFileSync(tmp, png);

    const { res: metaRes, json: meta } = await req(studentJar, "/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maSinhVien: ma,
        fieldKey: "anh",
        filename: "flow-test.png",
        contentType: "image/png",
        size: png.length,
      }),
    });

    if (!metaRes.ok) {
      fail("Upload-url", meta?.error || metaRes.status);
    } else {
      pass("Upload-url", meta.key);
      const put = await fetch(meta.url, {
        method: "PUT",
        headers: { "Content-Type": meta.contentType || "image/png" },
        body: png,
      });
      if (put.ok) {
        pass("R2 PUT upload", String(put.status));
        uploadedKey = meta.key;
      } else fail("R2 PUT upload", put.status);
    }
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }

  // Reject foreign key in change-request
  {
    const { res, json } = await req(studentJar, "/api/student/change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "edit",
        proposedFields: { soDienThoai: testPhone },
        proposedDocuments: {
          anh: {
            status: "co_file",
            files: [
              {
                key: "students/OTHER/anh/x-evil.png",
                name: "evil.png",
                size: 10,
                contentType: "image/png",
                uploadedAt: new Date().toISOString(),
              },
            ],
          },
        },
      }),
    });
    if (res.status === 400) pass("Reject foreign upload key", json?.error);
    else fail("Reject foreign upload key", `status ${res.status}`);
  }

  // Re-submit edit + uploaded file (if upload worked)
  {
    const docs = { ...(meBefore.documents || {}) };
    if (uploadedKey) {
      docs.anh = {
        status: "co_file",
        files: [
          {
            key: uploadedKey,
            name: "flow-test.png",
            size: 68,
            contentType: "image/png",
            uploadedAt: new Date().toISOString(),
          },
        ],
      };
    }
    const { res, json } = await req(studentJar, "/api/student/change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "edit",
        proposedFields: { ...pickEditable(meBefore), soDienThoai: testPhone },
        proposedDocuments: docs,
      }),
    });
    if (res.ok) pass("Resubmit with upload meta", json.intent);
    else fail("Resubmit with upload meta", json?.error || res.status);
  }

  // Admin approve (edit_approve with phone)
  {
    const { res, json } = await req(adminJar, `/api/admin/requests/${encodeURIComponent(ma)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit_approve",
        proposedFields: { soDienThoai: testPhone },
        proposedDocuments: uploadedKey
          ? {
              anh: {
                status: "co_file",
                files: [
                  {
                    key: uploadedKey,
                    name: "flow-test.png",
                    size: 68,
                    contentType: "image/png",
                    uploadedAt: new Date().toISOString(),
                  },
                ],
              },
            }
          : {},
      }),
    });
    if (res.ok) pass("Admin Valid / edit_approve");
    else fail("Admin Valid / edit_approve", json?.error || res.status);
  }

  // Official updated
  {
    const { res, json } = await req(adminJar, `/api/admin/students/${encodeURIComponent(ma)}`);
    if (res.ok && String(json.student.soDienThoai) === testPhone) {
      pass("Official updated after approve", testPhone);
    } else {
      fail(
        "Official updated after approve",
        `got ${json?.student?.soDienThoai}`
      );
    }
    if (uploadedKey) {
      const files = json.student?.documents?.anh?.files || [];
      if (files.some((f) => f.key === uploadedKey)) {
        pass("Uploaded image in official documents");
      } else fail("Uploaded image in official documents", "key missing");
    }
  }

  // Download signed URL (admin)
  if (uploadedKey) {
    const { res, json } = await req(
      adminJar,
      `/api/download?key=${encodeURIComponent(uploadedKey)}`
    );
    if (res.ok && json.url) pass("Download signed URL");
    else fail("Download signed URL", json?.error || res.status);
  }

  // Restore original phone (cleanup)
  {
    const { res, json } = await req(adminJar, `/api/admin/students/${encodeURIComponent(ma)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { soDienThoai: originalPhone } }),
    });
    if (res.ok) pass("Cleanup restore phone", originalPhone || "(empty)");
    else fail("Cleanup restore phone", json?.error || res.status);
  }

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function pickEditable(student) {
  const keys = [
    "hoVaTen",
    "hoVa",
    "ten",
    "gioiTinh",
    "ngaySinh",
    "ngay",
    "thang",
    "nam",
    "soDienThoai",
    "emailTruong",
    "emailCaNhan",
    "khuVuc",
    "diaChiThuongTru",
    "diaChiTamTru",
    "heDaoTao",
    "khoaDaoTao",
    "nganh",
    "lop",
    "lopChuNhiemThang89",
    "ghiChuXepLop",
    "svDaCoLaptop",
    "xepLopTinHoc",
    "khoaBanDau",
    "khoaHienTai",
    "noiSinh",
    "danToc",
    "canCuoc",
    "ngayNhapHoc",
    "tuVanTuyenSinh",
    "coSoHoc",
    "hoTenCha",
    "sdtCha",
    "hoTenMe",
    "sdtMe",
    "nguoiGiamHo",
    "sdtNguoiGiamHo",
    "truongThpt",
    "tinhTruong",
    "doiTuong",
    "diemTrungBinh",
    "hocBong",
    "thongTinSaiLech",
    "mayTinhHocTap",
    "ghiChuHoSo",
  ];
  const out = {};
  for (const k of keys) out[k] = String(student?.[k] ?? "");
  return out;
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n==== Summary: ${ok} passed, ${bad} failed ====`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
