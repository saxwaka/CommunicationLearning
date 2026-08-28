# CommunicationLearning

Web học giao tiếp tiếng Anh cho người Việt mới bắt đầu (A0–A1), **chạy hoàn toàn cục bộ bằng
mô hình mã nguồn mở** trên máy cá nhân. Người dùng hiện tại: một người.

- **Nói với AI** — hội thoại theo tình huống bằng giọng nói, chấm phát âm theo từng âm vị.
- **Flashcard SRS** — mẫu câu vừa nói tự động thành thẻ, ôn theo FSRS.

## Trạng thái

**Đã chốt kế hoạch, chưa bắt đầu thi công.** Chạy trên phần cứng hiện có — Ryzen 5 5600 ·
GTX 1060 6GB · 32GB RAM — không mua GPU mới.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| **[SPEC.md](docs/SPEC.md)** | **Đặc tả đã chốt.** Phiên bản ghim, tên model chính xác, giá trị cấu hình, ngân sách VRAM, ngưỡng nghiệm thu. Đọc cái này khi thi công |
| [PLAN-LOCAL.md](docs/PLAN-LOCAL.md) | Lý do đằng sau từng lựa chọn: giới hạn Pascal, ranh giới Docker, lộ trình 4 cuối tuần, hướng nâng cấp GPU sau này |
| [MODEL-RESEARCH.md](docs/MODEL-RESEARCH.md) | Khảo sát mô hình 8/2026: vì sao chọn Qwen3-4B-Instruct-2507, vì sao loại Gemma 4 E4B và các model chuyên Đông Nam Á |
| [PLAN.md](docs/PLAN.md) | Đích đến dài hạn — bản nhiều người dùng trên GPU đời mới |

## Stack

**Ứng dụng** — Next.js 15 (UI + API routes) · Prisma · **SQLite** · audio trên đĩa · chạy thẳng, không Docker

**Tầng AI** — Ollama + **Qwen3-4B-Instruct-2507** `Q4_K_M` (GPU) · faster-whisper `small` int8 (GPU) ·
wav2vec2 + GOP, ONNX INT8 (CPU) · Kokoro-82M (CPU) · Silero VAD (trình duyệt) · trong Docker

> GTX 1060 là Pascal (CC 6.1): **vLLM không chạy** (cần ≥ 7.0) và **CUDA 13 đã bỏ Pascal** —
> ghim CUDA 12.4. Chi tiết ở `docs/SPEC.md` mục 2.

## Bắt đầu

Ba phép thử ở `docs/SPEC.md` mục 7 — làm trước khi viết dòng code nào.
