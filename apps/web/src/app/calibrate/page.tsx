import Link from "next/link";
import { Calibrator } from "@/components/Calibrator";
import { CALIBRATION_SENTENCES } from "@/lib/sentences";

export const dynamic = "force-dynamic";

export default function CalibratePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link href="/" className="font-mono text-xs text-meta hover:text-ink">
          ← Quay lại luyện nói
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Hiệu chỉnh ngưỡng</h1>
        <div className="flex max-w-prose flex-col gap-3 text-ink-soft">
          <p>
            Điểm GOP là số âm không có thang đo, nên ngưỡng lấy từ giọng người khác sẽ sai.
            Hãy đọc {CALIBRATION_SENTENCES.length} câu dưới đây{" "}
            <strong className="text-ink">ở trạng thái tốt nhất của bạn</strong> — đọc chậm, rõ,
            trong phòng yên tĩnh.
          </p>
          <p>
            Hệ thống lấy phân bố điểm của chính bạn rồi cắt ở phân vị 25 và 10 để chia ba mức màu.
            Mất khoảng mười phút, và chỉ phải làm một lần.
          </p>
        </div>
      </header>

      <Calibrator sentences={[...CALIBRATION_SENTENCES]} />
    </main>
  );
}
