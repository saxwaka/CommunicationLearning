import { resolve } from "node:path";

/** Đọc biến môi trường một lần, ở một chỗ. */
export const env = {
  speechUrl: process.env.SPEECH_URL ?? "http://127.0.0.1:8000",
  ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  /** `next dev` chạy với cwd = apps/web, nên mặc định trỏ ngược về gốc repo. */
  dataDir: resolve(process.cwd(), process.env.DATA_DIR ?? "../../data"),
} as const;
