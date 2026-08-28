import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SpeechError, speech } from "@/lib/speech";
import { put } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — một lượt nói dài nhất cũng không tới

export async function POST(req: Request) {
  const started = Date.now();

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Thiếu trường `audio`." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Bản ghi rỗng — chưa thu được tiếng nào." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Bản ghi quá dài." }, { status: 413 });
  }

  const audio = Buffer.from(await file.arrayBuffer());
  const audioKey = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webm`;
  await put("audio", audioKey, audio);

  try {
    const result = await speech.transcribe(audio, "turn.webm");
    const recording = await db.recording.create({
      data: {
        audioKey,
        text: result.text,
        sttModel: result.model,
        durationMs: Math.round(result.durationMs),
        latencyMs: Date.now() - started,
      },
    });
    return NextResponse.json({
      id: recording.id,
      text: result.text,
      model: result.model,
      latencyMs: recording.latencyMs,
    });
  } catch (err) {
    // Audio đã lưu rồi — giữ lại bản ghi để còn thử lại được sau.
    await db.recording.create({ data: { audioKey, latencyMs: Date.now() - started } });
    if (err instanceof SpeechError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
