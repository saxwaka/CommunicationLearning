"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "recording" | "working" | "done" | "error";

export function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Nhả micro khi rời trang — không giữ đèn micro sáng vô cớ.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);

  const send = useCallback(async (blob: Blob) => {
    setStatus("working");
    const form = new FormData();
    form.append("audio", blob, "turn.webm");
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);
      setText(json.text ?? "");
      setLatency(json.latencyMs ?? null);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const start = useCallback(async () => {
    setError("");
    setText("");
    setLatency(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) void send(blob);
        else {
          setError("Không thu được tiếng nào. Kiểm tra micro?");
          setStatus("error");
        }
      };
      rec.start();
      recorderRef.current = rec;
      setStatus("recording");
    } catch {
      setError("Không truy cập được micro. Trình duyệt cần quyền, và trang phải chạy ở localhost.");
      setStatus("error");
    }
  }, [send]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
  }, []);

  const playBack = useCallback(async () => {
    if (!text) return;
    setSpeaking(true);
    setError("");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: `Lỗi ${res.status}` }));
        throw new Error(json.error);
      }
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeaking(false);
      };
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSpeaking(false);
    }
  }, [text]);

  const busy = status === "working";

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-sm border border-rule bg-surface px-6 py-10">
        <button
          type="button"
          disabled={busy}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          className="select-none rounded-full border-2 border-spot px-10 py-5 text-lg font-medium text-spot transition disabled:opacity-40 data-[on=true]:bg-spot data-[on=true]:text-paper"
          data-on={status === "recording"}
        >
          {status === "recording" ? "Đang nghe… thả ra để gửi" : "Bấm giữ để nói"}
        </button>
        <p className="font-mono text-xs text-meta">
          {busy ? "Đang chép lời…" : "Nói một câu tiếng Anh ngắn, ví dụ: Can I have a coffee, please?"}
        </p>
      </div>

      {text && (
        <div className="flex flex-col gap-3 rounded-sm border border-rule bg-surface px-5 py-4">
          <p className="text-lg">{text}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={playBack}
              disabled={speaking}
              className="rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-soft transition hover:border-spot hover:text-spot disabled:opacity-40"
            >
              {speaking ? "Đang phát…" : "Nghe giọng mẫu"}
            </button>
            {latency !== null && (
              <span className="font-mono text-xs text-meta">{latency}ms</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-sm border border-bad px-4 py-3 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
