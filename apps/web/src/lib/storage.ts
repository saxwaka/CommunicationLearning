/**
 * Ranh giới #4 — mọi thứ chạm vào đĩa đều đi qua đây.
 *
 * Hôm nay là thư mục trên ổ Windows. Muốn đổi sang S3 thì thay phần thân
 * của bốn hàm dưới đây, không phải đi tìm `fs.writeFile` rải khắp nơi.
 *
 * Xem docs/SPEC.md mục 6.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "./env";

export type Bucket = "audio" | "tts-cache";

function pathFor(bucket: Bucket, key: string): string {
  // Chặn key leo ra ngoài thư mục dữ liệu.
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error(`Khóa lưu trữ không hợp lệ: ${key}`);
  }
  return join(env.dataDir, bucket, key);
}

export async function put(bucket: Bucket, key: string, data: Buffer): Promise<string> {
  const path = pathFor(bucket, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return key;
}

export async function get(bucket: Bucket, key: string): Promise<Buffer | null> {
  try {
    return await readFile(pathFor(bucket, key));
  } catch {
    return null;
  }
}

export async function has(bucket: Bucket, key: string): Promise<boolean> {
  return (await get(bucket, key)) !== null;
}

/** Khóa ổn định cho cache TTS: cùng text + voice + speed thì cùng khóa. */
export function cacheKey(parts: Record<string, string | number>): string {
  const canonical = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}
