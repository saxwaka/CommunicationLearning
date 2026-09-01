# CommunicationLearning

Web học giao tiếp tiếng Anh cho người Việt mới bắt đầu (A0–A1), **chạy hoàn toàn cục bộ bằng
mô hình mã nguồn mở** trên máy cá nhân. Người dùng hiện tại: một người.

- **Nói với AI** — hội thoại theo tình huống bằng giọng nói, chấm phát âm theo từng âm vị.
- **Flashcard SRS** — mẫu câu vừa nói tự động thành thẻ, ôn theo FSRS.

## Trạng thái

**Cuối tuần 1 và 2 đã xong** — ghi âm → chép lời → nghe giọng mẫu, và chấm phát âm
tới từng âm vị với ngưỡng hiệu chỉnh theo giọng của chính bạn.
Chạy trên phần cứng hiện có: Ryzen 5 5600 · GTX 1060 6GB · 32GB RAM · **Windows**.

```powershell
pnpm install
pnpm speech:up     # speech-service trong Docker
docker compose -f docker/compose.yml --profile tools run --rm tools   # xuất ONNX, một lần
pnpm db:push
pnpm dev           # http://localhost:3000  →  /calibrate trước, rồi luyện
```

Hướng dẫn đầy đủ, kể cả bước tải trọng số Kokoro: [`docs/SETUP-WINDOWS.md`](docs/SETUP-WINDOWS.md).

Tiếp theo: cuối tuần 3 — hội thoại với Ollama, và đo `eval/cases.json`
để quyết định giữa Qwen3-4B-Instruct-2507 và MiniCPM5-1B.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Bối cảnh cho Claude Code — ràng buộc phần cứng, ranh giới kiến trúc, việc tiếp theo. Tự nạp mỗi phiên |
| **[SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md)** | **Cách chạy.** Chuẩn bị máy, dựng speech-service, nghiệm thu, xử lý trục trặc |
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

## Cấu trúc

```
apps/web/           Next.js 15 — UI, API routes, Prisma/SQLite. Chạy native Windows
services/speech/    FastAPI — faster-whisper, wav2vec2+GOP, Kokoro. Docker, stateless
  app/gop.py        thuật toán GOP thuần numpy, có test
  tests/            pytest — chạy được không cần model, không cần GPU
docker/compose.yml  Chỉ speech-service. Ollama native, Next.js native
data/               app.db, audio/, tts-cache/ — do Next.js sở hữu
docs/               Kế hoạch và đặc tả
```

Hai ranh giới quan trọng nhất, giữ từ đầu để đổi model về sau không phải viết lại:
`apps/web/src/lib/speech.ts` (`SpeechProvider`) và `apps/web/src/lib/storage.ts`.

Chạy test phần thuật toán chấm phát âm:

```bash
cd services/speech && python -m pytest tests/ -q
```
