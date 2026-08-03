import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type ServiceAccountFields = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function fromJsonEnv(): ServiceAccountFields | null {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;

  // Vercel sometimes wraps value in extra quotes
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    raw = raw.slice(1, -1);
  }

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("JSON thiếu project_id / client_email / private_key");
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "invalid JSON";
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_KEY không hợp lệ (${detail}). Dán nguyên nội dung file JSON service account.`
    );
  }
}

function fromSplitEnv(): ServiceAccountFields | null {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function resolveCredentials(): ServiceAccountFields {
  const fromJson = fromJsonEnv();
  if (fromJson) return fromJson;

  const fromSplit = fromSplitEnv();
  if (fromSplit) return fromSplit;

  throw new Error(
    "Thiếu cấu hình Firebase Admin. Trên Vercel hãy thêm FIREBASE_SERVICE_ACCOUNT_KEY = toàn bộ nội dung file JSON Service Account (Firebase Console → Project settings → Service accounts → Generate new private key)."
  );
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const creds = resolveCredentials();
  return initializeApp({
    credential: cert({
      projectId: creds.projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
    }),
  });
}

export function getDb(): Firestore {
  return getFirestore(getAdminApp());
}
