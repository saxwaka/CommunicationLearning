/**
 * Ngưỡng GOP được hiệu chỉnh bằng chính giọng của người dùng.
 *
 * GOP thô là số âm không có thang đo, nên ngưỡng tuyệt đối lấy từ giọng người
 * khác sẽ sai. Cách làm: đọc ~20 câu ở trạng thái tốt nhất, lấy phân bố GOP
 * của chính mình, cắt ở phân vị 25 và 10.
 *
 * Xem docs/PLAN-LOCAL.md mục 5.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./env";

export const MIN_CALIBRATION_SENTENCES = 20;
const PCT_WARN = 25;
const PCT_BAD = 10;

export type Level = "good" | "warn" | "bad" | "unknown";

export interface Calibration {
  warn: number;
  bad: number;
  sentenceCount: number;
  phoneCount: number;
  updatedAt: string;
  modelVersion: string | null;
}

const file = () => join(env.dataDir, "gop-calibration.json");

export async function load(): Promise<Calibration | null> {
  try {
    return JSON.parse(await readFile(file(), "utf8")) as Calibration;
  } catch {
    return null;
  }
}

export async function save(c: Calibration): Promise<void> {
  await mkdir(env.dataDir, { recursive: true });
  await writeFile(file(), `${JSON.stringify(c, null, 2)}\n`);
}

/** Phân vị theo kiểu nội suy tuyến tính, trên mảng đã sắp tăng dần. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new Error("Mảng rỗng.");
  if (sorted.length === 1) return sorted[0];
  const pos = ((sorted.length - 1) * p) / 100;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function computeThresholds(
  allPhoneGops: number[],
  meta: { sentenceCount: number; modelVersion: string | null },
): Calibration {
  const sorted = [...allPhoneGops].sort((a, b) => a - b);
  return {
    warn: percentile(sorted, PCT_WARN),
    bad: percentile(sorted, PCT_BAD),
    sentenceCount: meta.sentenceCount,
    phoneCount: sorted.length,
    updatedAt: new Date().toISOString(),
    modelVersion: meta.modelVersion,
  };
}

/** Chưa hiệu chỉnh thì trả "unknown" — im lặng tốt hơn tô màu sai. */
export function levelOf(gop: number, c: Calibration | null): Level {
  if (!c) return "unknown";
  if (gop <= c.bad) return "bad";
  if (gop <= c.warn) return "warn";
  return "good";
}
