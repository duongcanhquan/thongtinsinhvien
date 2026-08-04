/**
 * Lightweight regression checks for directory matching (no Firestore).
 * Run: node --experimental-strip-types isn't needed — use tsx or compile.
 * Invoked via: npx tsx scripts/check-directory-match.ts
 */
import {
  classifyDirectoryMatch,
  toDirectoryEntry,
  type DirectoryEntry,
} from "../src/lib/student-directory";
import type { Student } from "../src/lib/types";

function entry(partial: Partial<Student> & { maSinhVien: string; hoVaTen: string }): DirectoryEntry {
  return toDirectoryEntry({
    documents: {},
    emailCaNhan: "",
    soDienThoai: "",
    canCuoc: "",
    ...partial,
  });
}

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

const ngocAnh = entry({
  maSinhVien: "61112620026",
  hoVaTen: "BÙI THỊ NGỌC ANH",
  emailCaNhan: "buingocanh202208@gmail.com",
  soDienThoai: "0372070580",
  canCuoc: "024308005419",
});

const minh = entry({
  maSinhVien: "51112610019",
  hoVaTen: "NGUYỄN NHẬT MINH",
  emailCaNhan: "nguyenkhanhlinh10032017@gmail.com",
  soDienThoai: "0975500302",
  canCuoc: "001208026295",
});

assert(classifyDirectoryMatch(ngocAnh, "Ngọc Anh") === "name", "Ngọc Anh → name");
assert(classifyDirectoryMatch(ngocAnh, "anh") === "name", "anh → name for NGỌC ANH");
assert(classifyDirectoryMatch(ngocAnh, "ngoc anh") === "name", "ngoc anh (no accent) → name");
assert(classifyDirectoryMatch(ngocAnh, "0372070580") === "phone", "full phone");
assert(classifyDirectoryMatch(ngocAnh, "61112620026") === "ma", "student id");
assert(
  classifyDirectoryMatch(ngocAnh, "buingocanh202208@gmail.com") === "email",
  "full email"
);
assert(
  classifyDirectoryMatch(minh, "anh") === null,
  "anh must NOT match NGUYỄN NHẬT MINH via email substring"
);
assert(classifyDirectoryMatch(minh, "nguyen") === "name", "nguyen folded → name");
assert(classifyDirectoryMatch(minh, "Nguyễn") === "name", "Nguyễn → name");

const thanhTruc = entry({
  maSinhVien: "x1",
  hoVaTen: "ĐỖ THANH TRÚC",
  emailCaNhan: "truc@gmail.com",
});
assert(
  classifyDirectoryMatch(thanhTruc, "anh") === null,
  "anh must NOT match THANH (substring trap)"
);

const vanAnh = entry({
  maSinhVien: "x2",
  hoVaTen: "LÊ THỊ VÂN ANH",
});
assert(classifyDirectoryMatch(vanAnh, "anh") === "name", "token ANH still matches");

const khanh = entry({ maSinhVien: "x3", hoVaTen: "HOÀNG NGỌC KHÁNH" });
const oanh = entry({ maSinhVien: "x4", hoVaTen: "CHU THỊ NGỌC OANH" });
assert(
  classifyDirectoryMatch(khanh, "Ngọc Anh") === null,
  "Ngọc Anh must NOT match KHÁNH"
);
assert(
  classifyDirectoryMatch(oanh, "Ngọc Anh") === null,
  "Ngọc Anh must NOT match OANH"
);
assert(
  classifyDirectoryMatch(ngocAnh, "Ngọc Anh") === "name",
  "Ngọc Anh still matches BÙI THỊ NGỌC ANH"
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll directory match checks passed");
