import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const STUDENT_COOKIE = "sv_session";
const ADMIN_COOKIE = "admin_session";

export type StudentSession = {
  role: "student";
  maSinhVien: string;
};

export type AdminSession = {
  role: "admin";
};

function getSecret() {
  // Prefer SESSION_SECRET on Vercel; fall back so deploy still works.
  const secret =
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "admin123-thongtinsinhvien-session";
  return new TextEncoder().encode(secret);
}

function studentHours() {
  const n = Number(process.env.STUDENT_SESSION_HOURS ?? "4");
  return Number.isFinite(n) && n > 0 ? n : 4;
}

export async function createStudentSession(maSinhVien: string) {
  const hours = studentHours();
  const token = await new SignJWT({ role: "student", maSinhVien })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: hours * 60 * 60,
  });
}

export async function createAdminSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function clearStudentSession() {
  const jar = await cookies();
  jar.delete(STUDENT_COOKIE);
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

async function readToken<T>(name: string): Promise<T | null> {
  const jar = await cookies();
  const token = jar.get(name)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as T;
  } catch {
    return null;
  }
}

export async function getStudentSession(): Promise<StudentSession | null> {
  const payload = await readToken<StudentSession>(STUDENT_COOKIE);
  if (!payload || payload.role !== "student" || !payload.maSinhVien) return null;
  return payload;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const payload = await readToken<AdminSession>(ADMIN_COOKIE);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireStudent() {
  const session = await getStudentSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
