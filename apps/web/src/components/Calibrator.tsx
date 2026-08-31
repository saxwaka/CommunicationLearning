"use client";

import { useCallback, useEffect, useState } from "react";
import { useRecorder } from "./useRecorder";

interface Status {
  calibration: { warn: number; bad: number; sentenceCount: number; phoneCount: number } | null;
  done: number;
  needed: number;
}

export function Calibrator({ sentences }: { sentences: string[] }) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/calibrate");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (blob: Blob) => {
      const form = new FormData();
      form.append("audio", blob, "calib.webm");
      form.append("text", sentences[index]);
      form.append("calibration", "1");
      const res = await fetch("/api/assess", { method: "POST", body: form });
      if (!res.ok) {
        setError((await res.json()).error ?? `Lỗi ${res.status}`);
        return;
      }
      await refresh();
      setIndex((i) => Math.min(i + 1, sentences.length - 1));
    },
    [index, refresh, sentences],
  );

  const { state, error, setError, start, stop } = useRecorder(submit);

  const act = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/calibrate", { method });
      if (!res.ok) setError((await res.json()).error ?? `Lỗi ${res.status}`);
      if (method === "DELETE") setIndex(0);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const done = status?.done ?? 0;
  const needed = status?.needed ?? sentences.length;
  const ready = done >= needed;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between font-mono text-xs text-meta">
          <span>ĐÃ THU {done}/{needed}</span>
          {status?.calibration && (
            <span className="tabular-nums">
              ngưỡng {status.calibration.warn.toFixed(2)} / {status.calibration.bad.toFixed(2)}
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-rule">
          <div
            className="h-full bg-spot transition-all"
            style={{ width: `${Math.min(100, (done / needed) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 rounded-sm border border-rule bg-surface px-6 py-8">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-meta">
          Câu {index + 1}/{sentences.length}
        </span>
        <p className="text-center text-2xl leading-relaxed">{sentences[index]}</p>
        <button
          type="button"
          disabled={state === "working"}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          data-on={state === "recording"}
          className="select-none rounded-full border-2 border-spot px-9 py-4 font-medium text-spot transition disabled:opacity-40 data-[on=true]:bg-spot data-[on=true]:text-paper"
        >
          {state === "recording"
            ? "Đang nghe… thả ra"
            : state === "working"
              ? "Đang xử lý…"
              : "Bấm giữ để đọc"}
        </button>
        <div className="flex gap-4 font-mono text-xs text-meta">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            ← câu trước
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(sentences.length - 1, i + 1))}
          >
            câu sau →
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => act("POST")}
          disabled={!ready || busy}
          className="rounded-sm border-2 border-spot px-4 py-2 text-sm font-medium text-spot transition disabled:opacity-40"
        >
          {ready ? "Tính ngưỡng từ giọng của tôi" : `Cần thêm ${needed - done} câu`}
        </button>
        {done > 0 && (
          <button
            type="button"
            onClick={() => act("DELETE")}
            disabled={busy}
            className="rounded-sm border border-rule px-3 py-2 text-sm text-meta transition hover:border-bad hover:text-bad disabled:opacity-40"
          >
            Xoá và làm lại
          </button>
        )}
      </div>

      {status?.calibration && (
        <p className="rounded-sm border border-good/40 bg-good/10 px-4 py-3 text-sm text-ink-soft">
          Đã hiệu chỉnh từ {status.calibration.sentenceCount} câu,{" "}
          {status.calibration.phoneCount} âm vị. Ngưỡng vàng{" "}
          <span className="font-mono">{status.calibration.warn.toFixed(2)}</span>, ngưỡng đỏ{" "}
          <span className="font-mono">{status.calibration.bad.toFixed(2)}</span>.
        </p>
      )}

      {error && (
        <p className="rounded-sm border border-bad px-4 py-3 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
