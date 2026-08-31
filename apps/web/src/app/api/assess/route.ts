import { NextResponse } from "next/server";
import * as calib from "@/lib/calibration";
import { db } from "@/lib/db";
import { SpeechError, speech } from "@/lib/speech";
import { put } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const started = Date.now();

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  const targetText = String(form?.get("text") ?? "").trim();
  const isCalibration = form?.get("calibration") === "1";

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Bản ghi rỗng hoặc thiếu." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Bản ghi quá dài." }, { status: 413 });
  }
  if (!targetText) {
    return NextResponse.json({ error: "Thiếu câu đích." }, { status: 400 });
  }

  const audio = Buffer.from(await file.arrayBuffer());
  const audioKey = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webm`;
  await put("audio", audioKey, audio);

  try {
    const result = await speech.assess(audio, "turn.webm", targetText);
    const calibration = await calib.load();

    await db.assessment.create({
      data: {
        audioKey,
        targetText,
        sentenceGop: result.sentenceGop,
        worstGop: result.worstGop,
        phoneCount: result.phoneCount,
        words: JSON.stringify(result.words),
        isCalibration,
        modelVersion: "wav2vec2-lv-60-espeak/onnx-int8",
        latencyMs: Date.now() - started,
      },
    });

    return NextResponse.json({
      words: result.words.map((w) => ({
        ...w,
        level: calib.levelOf(w.gop, calibration),
        phones: w.phones.map((p) => ({ ...p, level: calib.levelOf(p.gop, calibration) })),
      })),
      sentenceGop: result.sentenceGop,
      worstGop: result.worstGop,
      calibrated: calibration !== null,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    if (err instanceof SpeechError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
