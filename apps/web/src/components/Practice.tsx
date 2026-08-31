"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { LEVEL_CLASS, type Level, useRecorder } from "./useRecorder";

interface Phone {
  phone: string;
  gop: number;
  heardAs: string;
  level: Level;
}
interface Word {
  text: string;
  gop: number;
  dropped: string[];
  phones: Phone[];
  level: Level;
}
interface Result {
  words: Word[];
  worstGop: number;
  calibrated: boolean;
  latencyMs: number;
}

export function Practice({ sentences }: { sentences: string[] }) {
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [openWord, setOpenWord] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const target = sentences[index];

  const submit = useCallback(
    async (blob: Blob) => {
      const form = new FormData();
      form.append("audio", blob, "turn.webm");
      form.append("text", target);
      const res = await fetch("/api/assess", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Lỗi ${res.status}`);
        setResult(null);
        return;
      }
      setResult(json as Result);
      setOpenWord(null);
    },
    [target],
  );

  const { state, error, setError, start, stop } = useRecorder(submit);

  const next = () => {
    setIndex((i) => (i + 1) % sentences.length);
    setResult(null);
    setOpenWord(null);
    setError("");
  };

  const listen = async () => {
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: target }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeaking(false);
      };
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSpeaking(false);
    }
  };

  // Chỉ nhấn vào âm tệ nhất. Căn chỉnh cưỡng bức làm âm kế bên bị vạ lây,
  // nên bôi đỏ mọi âm dưới ngưỡng sẽ khiến người học không biết sửa cái nào.
  const worstIndex = result
    ? result.words.reduce((w, cur, i, arr) => (cur.gop < arr[w].gop ? i : w), 0)
    : -1;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-sm border border-rule bg-surface px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-meta">
            Câu {index + 1}/{sentences.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={listen}
              disabled={speaking}
              className="rounded-sm border border-rule px-3 py-1 text-xs text-ink-soft transition hover:border-spot hover:text-spot disabled:opacity-40"
            >
              {speaking ? "Đang phát…" : "Nghe mẫu"}
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-sm border border-rule px-3 py-1 text-xs text-ink-soft transition hover:border-spot hover:text-spot"
            >
              Câu khác
            </button>
          </div>
        </div>

        {result ? (
          <p className="flex flex-wrap gap-x-2 gap-y-3 text-2xl leading-relaxed">
            {result.words.map((w, i) => (
              <button
                key={`${w.text}-${i}`}
                type="button"
                onClick={() => setOpenWord(openWord === i ? null : i)}
                className={`rounded-sm px-1.5 py-0.5 transition ${LEVEL_CLASS[w.level]} ${
                  i === worstIndex && w.level === "bad" ? "ring-2 ring-bad/50" : ""
                }`}
              >
                {w.text}
              </button>
            ))}
          </p>
        ) : (
          <p className="text-2xl leading-relaxed">{target}</p>
        )}

        {result && !result.calibrated && (
          <p className="rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink-soft">
            Chưa hiệu chỉnh ngưỡng nên chưa tô màu được — điểm thô vẫn hiện khi bấm vào từ.{" "}
            <Link href="/calibrate" className="underline">
              Hiệu chỉnh ngay
            </Link>
            .
          </p>
        )}

        {result && openWord !== null && (
          <div className="flex flex-col gap-2 rounded-sm border border-rule bg-paper px-4 py-3">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-meta">
              {result.words[openWord].text}
            </span>
            <ul className="flex flex-col gap-1.5">
              {result.words[openWord].phones.map((p, i) => (
                <li key={i} className="flex items-baseline gap-3 text-sm">
                  <span className={`rounded-sm px-1.5 font-mono ${LEVEL_CLASS[p.level]}`}>
                    /{p.phone}/
                  </span>
                  <span className="font-mono text-xs tabular-nums text-meta">
                    {p.gop.toFixed(2)}
                  </span>
                  {p.heardAs !== p.phone && (
                    <span className="text-ink-soft">
                      nghe giống <span className="font-mono">/{p.heardAs}/</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {result.words[openWord].dropped.length > 0 && (
              <p className="font-mono text-xs text-meta">
                bỏ qua: {result.words[openWord].dropped.join(" ")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={state === "working"}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          data-on={state === "recording"}
          className="select-none rounded-full border-2 border-spot px-10 py-5 text-lg font-medium text-spot transition disabled:opacity-40 data-[on=true]:bg-spot data-[on=true]:text-paper"
        >
          {state === "recording"
            ? "Đang nghe… thả ra để chấm"
            : state === "working"
              ? "Đang chấm…"
              : "Bấm giữ để đọc câu trên"}
        </button>
        {result && (
          <span className="font-mono text-xs text-meta">
            tệ nhất {result.worstGop.toFixed(2)} · {result.latencyMs}ms
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-sm border border-bad px-4 py-3 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
