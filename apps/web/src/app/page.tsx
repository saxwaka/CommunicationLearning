import Link from "next/link";
import { Practice } from "@/components/Practice";
import * as calib from "@/lib/calibration";
import { PRACTICE_SENTENCES } from "@/lib/sentences";

export const dynamic = "force-dynamic";

export default async function Home() {
  const calibration = await calib.load();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-meta">
          Cuối tuần 2 · biết mình sai ở đâu
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Luyện nói A0</h1>
        <p className="max-w-prose text-ink-soft">
          Bấm giữ để đọc câu bên dưới. Mỗi từ được tô màu theo điểm phát âm; bấm vào một từ
          để xem từng âm vị và âm nào bị đọc lệch.
        </p>
      </header>

      <Practice sentences={[...PRACTICE_SENTENCES]} />

      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-rule pt-5 font-mono text-xs text-meta">
        <Link href="/calibrate" className="hover:text-ink">
          {calibration ? "Hiệu chỉnh lại ngưỡng" : "→ Hiệu chỉnh ngưỡng (chưa làm)"}
        </Link>
        <Link href="/freetalk" className="hover:text-ink">
          Nói tự do
        </Link>
        {calibration && (
          <span className="tabular-nums">
            ngưỡng {calibration.warn.toFixed(2)} / {calibration.bad.toFixed(2)} ·{" "}
            {calibration.sentenceCount} câu
          </span>
        )}
      </footer>
    </main>
  );
}
