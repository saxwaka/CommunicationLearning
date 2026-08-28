import { NextResponse } from "next/server";
import { SpeechError, speech } from "@/lib/speech";
import { cacheKey, get, put } from "@/lib/storage";

export const runtime = "nodejs";

const DEFAULT_SPEED = Number(process.env.TTS_SPEED ?? 0.85); // chốt cho A0
const DEFAULT_VOICE = process.env.TTS_VOICE ?? "af_heart";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    text?: string;
    voice?: string;
    speed?: number;
  } | null;

  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Thiếu trường `text`." }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Câu quá dài." }, { status: 413 });
  }

  const voice = body?.voice ?? DEFAULT_VOICE;
  const speed = body?.speed ?? DEFAULT_SPEED;
  const key = `${cacheKey({ text, voice, speed })}.wav`;

  // Cache-first: phần lớn câu trong app là câu kịch bản, sinh một lần rồi thôi.
  const cached = await get("tts-cache", key);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      headers: { "content-type": "audio/wav", "x-cache": "hit" },
    });
  }

  try {
    const { audio, contentType } = await speech.synthesize(text, { voice, speed });
    await put("tts-cache", key, audio);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "content-type": contentType, "x-cache": "miss" },
    });
  } catch (err) {
    if (err instanceof SpeechError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
