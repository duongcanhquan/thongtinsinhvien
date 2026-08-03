"use client";

import {
  birthDateError,
  birthDateFromParts,
  birthPartsFromDate,
  digitsPhone10,
  isValidBirthDate,
  maskBirthDateInput,
  normalizeBirthDate,
  phoneError,
} from "@/lib/student-fields";

type BirthProps = {
  ngaySinh: string;
  ngay: string;
  thang: string;
  nam: string;
  onChange: (next: {
    ngaySinh: string;
    ngay: string;
    thang: string;
    nam: string;
  }) => void;
  inputClassName?: string;
};

export function BirthDateFields({
  ngaySinh,
  ngay,
  thang,
  nam,
  onChange,
  inputClassName = "min-h-12 w-full rounded-xl border border-border bg-white px-3 text-base",
}: BirthProps) {
  const err = birthDateError(ngaySinh);

  function setDate(value: string) {
    const masked = maskBirthDateInput(value);
    const normalized = normalizeBirthDate(masked);
    const use = isValidBirthDate(normalized) ? normalized : masked;
    const parts = isValidBirthDate(use)
      ? birthPartsFromDate(use)
      : { ngay, thang, nam };
    onChange({
      ngaySinh: use,
      ngay: parts.ngay || ngay,
      thang: parts.thang || thang,
      nam: parts.nam || nam,
    });
  }

  function setPart(part: "ngay" | "thang" | "nam", value: string) {
    const digits = value.replace(/\D/g, "");
    const next = {
      ngay: part === "ngay" ? digits.slice(0, 2) : String(ngay ?? ""),
      thang: part === "thang" ? digits.slice(0, 2) : String(thang ?? ""),
      nam: part === "nam" ? digits.slice(0, 4) : String(nam ?? ""),
    };
    const composed = birthDateFromParts(next.ngay, next.thang, next.nam);
    onChange({
      ngaySinh: composed || ngaySinh,
      ngay: next.ngay,
      thang: next.thang,
      nam: next.nam,
    });
  }

  return (
    <div className="block text-sm sm:col-span-1">
      <span className="font-semibold text-foreground/75">
        Ngày sinh <span className="font-normal text-foreground/50">(DD/MM/YYYY)</span>
      </span>
      <input
        className={`mt-1 ${inputClassName} ${err ? "border-destructive" : ""}`}
        inputMode="numeric"
        placeholder="15/08/2005"
        maxLength={10}
        value={ngaySinh || ""}
        onChange={(e) => setDate(e.target.value)}
        onBlur={() => {
          const n = normalizeBirthDate(ngaySinh);
          if (isValidBirthDate(n)) {
            const parts = birthPartsFromDate(n);
            onChange({ ngaySinh: n, ...parts });
          }
        }}
        aria-invalid={Boolean(err)}
      />
      {err ? (
        <p className="mt-1 text-xs text-destructive">{err}</p>
      ) : (
        <p className="mt-1 text-[11px] text-foreground/45">
          Ví dụ đúng: 03/09/2006 — không ghi 3/9/06
        </p>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="block text-xs">
          <span className="font-semibold text-foreground/60">Ngày</span>
          <input
            className={`mt-1 ${inputClassName} min-h-10 px-2 text-center`}
            inputMode="numeric"
            placeholder="DD"
            maxLength={2}
            value={ngay || ""}
            onChange={(e) => setPart("ngay", e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-foreground/60">Tháng</span>
          <input
            className={`mt-1 ${inputClassName} min-h-10 px-2 text-center`}
            inputMode="numeric"
            placeholder="MM"
            maxLength={2}
            value={thang || ""}
            onChange={(e) => setPart("thang", e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-foreground/60">Năm</span>
          <input
            className={`mt-1 ${inputClassName} min-h-10 px-2 text-center`}
            inputMode="numeric"
            placeholder="YYYY"
            maxLength={4}
            value={nam || ""}
            onChange={(e) => setPart("nam", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

type PhoneProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputClassName?: string;
};

export function PhoneField({
  label,
  value,
  onChange,
  required,
  inputClassName = "min-h-12 w-full rounded-xl border border-border bg-white px-3 text-base",
}: PhoneProps) {
  const err = phoneError(value, Boolean(required));
  return (
    <label className="block text-sm">
      <span className="font-semibold text-foreground/75">{label}</span>
      <input
        className={`mt-1 ${inputClassName} ${err ? "border-destructive" : ""}`}
        inputMode="numeric"
        placeholder="0901234567"
        maxLength={10}
        value={value || ""}
        onChange={(e) => onChange(digitsPhone10(e.target.value))}
        aria-invalid={Boolean(err)}
      />
      {err ? (
        <p className="mt-1 text-xs text-destructive">{err}</p>
      ) : (
        <p className="mt-1 text-[11px] text-foreground/45">Đủ đúng 10 chữ số</p>
      )}
    </label>
  );
}

const PHONE_KEYS = new Set([
  "soDienThoai",
  "sdtCha",
  "sdtMe",
  "sdtNguoiGiamHo",
]);

export function isPhoneKey(key: string) {
  return PHONE_KEYS.has(key);
}

export function validateProfileFields(fields: Record<string, string>): string | null {
  if (fields.ngaySinh) {
    const e = birthDateError(fields.ngaySinh);
    if (e) return e;
  } else if (fields.ngay || fields.thang || fields.nam) {
    const composed = birthDateFromParts(fields.ngay, fields.thang, fields.nam);
    if (!composed) return "Ngày / Tháng / Năm sinh không hợp lệ";
  }

  for (const key of PHONE_KEYS) {
    const e = phoneError(fields[key] || "", false);
    if (e) {
      const label =
        key === "soDienThoai"
          ? "Số điện thoại"
          : key === "sdtCha"
            ? "SĐT cha"
            : key === "sdtMe"
              ? "SĐT mẹ"
              : "SĐT người giám hộ";
      return `${label}: ${e}`;
    }
  }
  return null;
}
