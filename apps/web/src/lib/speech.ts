/**
 * Ranh giới #1 — mọi lời gọi STT / chấm phát âm / TTS đi qua đây.
 *
 * Lớp nghiệp vụ không được biết hôm nay là faster-whisper hay cái gì khác.
 * Đổi model, đổi sang API, đổi máy — sửa đúng file này.
 *
 * Xem docs/SPEC.md mục 6.
 */
import { env } from "./env";

export interface TranscriptResult {
  text: string;
  /** Model nào tạo ra kết quả — ghi vào DB để so sánh được khi đổi model. */
  model: string;
  durationMs: number;
}

export interface PhoneScore {
  phone: string;
  gop: number;
  /** Âm vị mà mô hình nghe giống nhất — để nói "bạn đọc thành /s/". */
  heardAs: string;
  startMs: number;
  endMs: number;
}

export interface WordScore {
  text: string;
  /** MIN của các âm trong từ: một âm sai đủ làm cả từ nghe sai. */
  gop: number;
  gopMean: number;
  /** Âm espeak sinh ra nhưng model không biết — bỏ qua, ghi lại để gỡ rối. */
  dropped: string[];
  phones: PhoneScore[];
}

export interface AssessmentResult {
  words: WordScore[];
  sentenceGop: number;
  worstGop: number;
  phoneCount: number;
  durationMs: number;
}

export interface SynthesisResult {
  audio: Buffer;
  contentType: string;
}

export interface SpeechProvider {
  transcribe(audio: Buffer, filename: string): Promise<TranscriptResult>;
  assess(audio: Buffer, filename: string, targetText: string): Promise<AssessmentResult>;
  synthesize(text: string, opts?: { voice?: string; speed?: number }): Promise<SynthesisResult>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

/** Lỗi có thông điệp đọc được, để UI hiển thị thẳng thay vì "500". */
export class SpeechError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "SpeechError";
  }
}

async function call(path: string, init: RequestInit, timeoutMs = 60_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.speechUrl}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new SpeechError(
        `speech-service trả về ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        res.status === 503 ? 503 : 502,
      );
    }
    return res;
  } catch (err) {
    if (err instanceof SpeechError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new SpeechError("speech-service không phản hồi kịp (quá 60 giây).", 504);
    }
    throw new SpeechError(
      `Không kết nối được speech-service ở ${env.speechUrl}. ` +
        `Đã chạy \`pnpm speech:up\` chưa?`,
    );
  } finally {
    clearTimeout(timer);
  }
}

class HttpSpeechProvider implements SpeechProvider {
  async transcribe(audio: Buffer, filename: string): Promise<TranscriptResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)]), filename);
    const res = await call("/transcribe", { method: "POST", body: form });
    const json = (await res.json()) as { text: string; model: string; duration_ms: number };
    return { text: json.text, model: json.model, durationMs: json.duration_ms };
  }

  async assess(audio: Buffer, filename: string, targetText: string): Promise<AssessmentResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)]), filename);
    form.append("text", targetText);
    const res = await call("/assess", { method: "POST", body: form });
    const json = (await res.json()) as {
      words: {
        text: string;
        gop: number;
        gop_mean: number;
        dropped: string[];
        phones: { phone: string; gop: number; heard_as: string; start_ms: number; end_ms: number }[];
      }[];
      sentence_gop: number;
      worst_gop: number;
      phone_count: number;
      duration_ms: number;
    };
    return {
      words: json.words.map((w) => ({
        text: w.text,
        gop: w.gop,
        gopMean: w.gop_mean,
        dropped: w.dropped,
        phones: w.phones.map((p) => ({
          phone: p.phone,
          gop: p.gop,
          heardAs: p.heard_as,
          startMs: p.start_ms,
          endMs: p.end_ms,
        })),
      })),
      sentenceGop: json.sentence_gop,
      worstGop: json.worst_gop,
      phoneCount: json.phone_count,
      durationMs: json.duration_ms,
    };
  }

  async synthesize(
    text: string,
    opts: { voice?: string; speed?: number } = {},
  ): Promise<SynthesisResult> {
    const res = await call("/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice: opts.voice, speed: opts.speed }),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { audio: buf, contentType: res.headers.get("content-type") ?? "audio/wav" };
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await call("/health", { method: "GET" }, 5_000);
      return { ok: true, detail: await res.text() };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const speech: SpeechProvider = new HttpSpeechProvider();
