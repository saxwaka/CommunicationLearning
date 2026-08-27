# CommunicationLearning

Web học giao tiếp tiếng Anh dành cho người Việt mới bắt đầu (A0–A1).
**Toàn bộ AI chạy bằng mô hình mã nguồn mở, tự host** — không gọi API bên thứ ba.

Hai vòng lặp học tập chính:

- **Nói với AI** — hội thoại theo tình huống bằng giọng nói, chấm phát âm tới từng âm vị, sửa lỗi ngay.
- **Flashcard SRS** — mẫu câu vừa nói tự động thành thẻ, ôn theo thuật toán lặp lại ngắt quãng (FSRS).

## Tài liệu

- [Kế hoạch xây dựng sản phẩm](docs/PLAN.md) — đối tượng, phạm vi MVP, chọn mô hình, kiểm toán giấy phép,
  kiến trúc, mô hình dữ liệu, lộ trình 16 tuần, chi phí và rủi ro.

## Stack dự kiến

**Ứng dụng** — Next.js 15 · TypeScript · Tailwind · NestJS · Prisma · PostgreSQL · Redis/BullMQ · Docker Compose

**Tầng AI (tự host)** — vLLM + Qwen3-8B (Apache 2.0) · faster-whisper large-v3-turbo (MIT) ·
wav2vec2 + GOP + GOPT cho chấm phát âm · Kokoro-82M TTS (Apache 2.0) · Silero VAD (MIT)

Mọi trọng số và bộ dữ liệu đưa vào sản phẩm đều phải được ghi trong `docs/LICENSES.md` kèm giấy phép gốc.
