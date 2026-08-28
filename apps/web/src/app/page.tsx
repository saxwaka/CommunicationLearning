import { Recorder } from "@/components/Recorder";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = await db.recording
    .findMany({ where: { text: { not: null } }, orderBy: { createdAt: "desc" }, take: 5 })
    .catch(() => []);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-meta">
          Cuối tuần 1 · nghe được và nói được
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Luyện nói A0</h1>
        <p className="max-w-prose text-ink-soft">
          Bấm giữ để nói một câu tiếng Anh. Bản chép lời sẽ hiện ra bên dưới, và bạn có thể
          bấm nghe lại giọng mẫu của chính câu đó.
        </p>
      </header>

      <Recorder />

      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-meta">
            Những câu gần đây
          </h2>
          <ul className="flex flex-col gap-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="rounded-sm border border-rule bg-surface px-4 py-3 text-sm text-ink-soft"
              >
                {r.text}
                <span className="ml-2 font-mono text-xs text-meta">
                  {r.latencyMs ? `${r.latencyMs}ms` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
