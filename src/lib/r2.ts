import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export function assertUploadMeta(contentType: string, size: number) {
  const type = normalizeContentType(contentType);
  if (!ALLOWED_TYPES.has(type) && type !== "application/octet-stream") {
    throw new Error("Chỉ chấp nhận PDF hoặc ảnh");
  }
  if (size <= 0 || size > MAX_BYTES) {
    throw new Error("Mỗi file tối đa 15MB");
  }
  return type;
}

function normalizeContentType(contentType: string) {
  return (contentType || "").split(";")[0]?.trim().toLowerCase() || "";
}

export function guessContentType(filename: string, fallback = ""): string {
  const known = normalizeContentType(fallback);
  if (ALLOWED_TYPES.has(known)) return known;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
  };
  return map[ext] || "application/octet-stream";
}

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Thiếu cấu hình R2");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

export async function createUploadUrl(params: {
  key: string;
  contentType: string;
  size: number;
}) {
  const contentType = assertUploadMeta(params.contentType, params.size);
  if (contentType === "application/octet-stream") {
    throw new Error("Chỉ chấp nhận PDF hoặc ảnh");
  }
  const { client, bucket } = getR2();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
  return { url, key: params.key, contentType };
}

export async function createDownloadUrl(key: string) {
  const { client, bucket } = getR2();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 60 * 10 });
}

export function buildObjectKey(
  maSinhVien: string,
  fieldKey: string,
  filename: string
) {
  const safe = filename.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  const id = crypto.randomUUID();
  return `students/${maSinhVien}/${fieldKey}/${id}-${safe}`;
}

export { MAX_BYTES, ALLOWED_TYPES };
