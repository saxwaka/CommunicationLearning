# CommunicationLearning

Web học giao tiếp tiếng Anh dành cho người Việt mới bắt đầu (A0–A1).
**Toàn bộ AI chạy bằng mô hình mã nguồn mở, tự host** — không gọi API bên thứ ba.

Hai vòng lặp học tập chính:

- **Nói với AI** — hội thoại theo tình huống bằng giọng nói, chấm phát âm theo từng âm vị, sửa lỗi ngay.
- **Flashcard SRS** — mẫu câu vừa nói tự động thành thẻ, ôn theo thuật toán lặp lại ngắt quãng (FSRS).

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| **[PLAN-LOCAL.md](docs/PLAN-LOCAL.md)** | **Đang thi công.** Bản chạy trên máy cá nhân (Ryzen 5 5600 · GTX 1060 6GB · 32GB RAM), phục vụ một người. Lộ trình 4 cuối tuần |
| [PLAN.md](docs/PLAN.md) | Đích đến — bản nhiều người dùng, GPU đời mới. Lộ trình 16 tuần, chi phí, kiểm toán giấy phép |

## Stack hiện tại (bản máy cá nhân)

**Ứng dụng** — Next.js 15 (UI + API routes) · TypeScript · Tailwind · Prisma · **SQLite** · audio lưu trên đĩa

**Tầng AI** — Ollama/llama.cpp + Qwen3-4B `Q4_K_M` (GPU) · faster-whisper `small` int8 (GPU) ·
wav2vec2 + GOP (CPU) · Kokoro-82M TTS (CPU) · Silero VAD (trình duyệt)

> GTX 1060 là kiến trúc Pascal (compute capability 6.1): **vLLM không chạy** (cần ≥ 7.0) và
> **CUDA 13 đã bỏ hỗ trợ Pascal** — phải bám CUDA 12.x. Chi tiết ở `docs/PLAN-LOCAL.md` mục 1.

Mọi trọng số và bộ dữ liệu đưa vào sản phẩm đều phải được ghi trong `docs/LICENSES.md` kèm giấy phép gốc.
