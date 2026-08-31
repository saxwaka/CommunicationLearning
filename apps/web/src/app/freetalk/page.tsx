import Link from "next/link";
import { Recorder } from "@/components/Recorder";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FreeTalk() {
  const recent = await db.recording
    .findMany({ where: { text: { not: null } }, orderBy: { createdAt: "desc" }, take: 5 })
    .catch(() => []);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link href="/" className="font-mono text-xs text-meta hover:text-ink">
          ← Quay lại luyện phát âm
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Nói tự do</h1>
        <p className="max-w-prose text-ink-soft">
          Nói bất cứ câu nào và xem hệ thống chép lại thành chữ. Ở đây không chấm phát âm —
          chấm phát âm cần biết trước câu đích.
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
