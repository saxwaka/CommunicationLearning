"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "recording" | "working";

/** Bấm-giữ-để-nói. VAD của Silero sẽ thay chỗ này từ cuối tuần 3, khi hội thoại
 *  cần tự biết lúc nào người học nói xong. */
export function useRecorder(onDone: (blob: Blob) => Promise<void> | void) {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setError("Không thu được tiếng nào. Kiểm tra micro?");
          setState("idle");
          return;
        }
        setState("working");
        try {
          await onDone(blob);
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recorderRef.current = rec;
      setState("recording");
    } catch {
      setError("Không truy cập được micro. Trang phải chạy ở localhost và cần cấp quyền.");
      setState("idle");
    }
  }, [onDone]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
  }, []);

  return { state, error, setError, start, stop };
}

export type Level = "good" | "warn" | "bad" | "unknown";

export const LEVEL_CLASS: Record<Level, string> = {
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad underline decoration-wavy underline-offset-4",
  unknown: "bg-rule/40 text-ink-soft",
};
