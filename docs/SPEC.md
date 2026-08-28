# Đặc tả đã chốt — Giai đoạn 0

> **Trạng thái: CHỐT** ngày 2026-08-27. Chạy trên phần cứng hiện có, **không mua GPU**.
> Đây là bản tham chiếu để thi công: mọi phiên bản, tên model và giá trị cấu hình đều đã cố định.
> Lý do đằng sau từng lựa chọn nằm ở [`PLAN-LOCAL.md`](./PLAN-LOCAL.md) — tài liệu này chỉ nói *cái gì*, không nói *vì sao*.

---

## 1. Những gì đã chốt

| Hạng mục | Chốt |
|---|---|
| Phần cứng | Ryzen 5 5600 · **GTX 1060 6GB** · 32GB RAM. **Không mua GPU mới** |
| Người dùng | 1 (tác giả). Không có auth, không có hạn mức |
| LLM | **Qwen3-4B-Instruct-2507** `Q4_K_M`, chạy GPU. Bản *không suy nghĩ* |
| STT | faster-whisper `small`, `compute_type="int8"`, chạy GPU |
| Chấm phát âm | wav2vec2 phoneme + GOP thô, ONNX INT8, chạy **CPU** |
| TTS | Kokoro-82M ONNX, chạy **CPU**, cache-first |
| VAD | Silero VAD, chạy **trong trình duyệt** |
| CSDL | SQLite qua Prisma. Một file |
| Docker | Chỉ `speech-service` và `ollama`. Next.js chạy thẳng |
| CUDA | **12.4** — không được lên 13.x |
| Lộ trình | 4 cuối tuần, mỗi mốc ra một thứ dùng được |

---

## 2. Nền tảng — ghim phiên bản

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| NVIDIA driver | ≥ 550 (nhánh CUDA 12.x) | **Không nâng lên nhánh chỉ hỗ trợ CUDA 13** |
| CUDA runtime | 12.4 | Qua ảnh Docker, không cần cài toolkit lên máy |
| Ảnh nền speech-service | `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04` | |
| NVIDIA Container Toolkit | bản mới nhất | Cài trên máy chủ, cần cho `--gpus` |
| Node | 22 LTS | |
| pnpm | 9.x | |
| Python | **3.12** | Không dùng 3.13 — một số wheel còn thiếu |
| Docker Compose | v2 | |

Kiểm tra nhanh trước khi bắt đầu:

```bash
nvidia-smi                              # thấy GTX 1060, driver >= 550
docker run --rm --gpus all \
  nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi   # GPU vào được container
```

---

## 3. Model — tên chính xác

| Vai trò | Định danh | Kích thước | Chạy ở |
|---|---|---|---|
| LLM | `Qwen3-4B-Instruct-2507` `Q4_K_M` — GGUF từ `unsloth/Qwen3-4B-Instruct-2507-GGUF` | ~2,5 GB VRAM | GPU |
| STT | `Systran/faster-whisper-small` | ~0,6 GB VRAM | GPU |
| Chấm phát âm | `facebook/wav2vec2-lv-60-espeak-cv-ft` | ~0,32 GB RAM sau khi lượng tử hóa | CPU |
| TTS | `hexgrad/Kokoro-82M` qua gói `kokoro-onnx` | ~0,3 GB RAM | CPU |
| VAD | `@ricky0123/vad-web` (bọc Silero VAD) | ~50 MB | Trình duyệt |

**Lưu ý về wav2vec2:** bản này là mô hình *large* (~317M tham số), không phải base — nó nhận diện âm vị IPA nên là thứ dùng được ngay cho GOP. Chạy thẳng ở FP32 trên CPU sẽ mất khoảng 1,5 giây cho 5 giây audio, quá chậm. **Bắt buộc phải xuất ONNX rồi lượng tử hóa động sang INT8**: dung lượng còn khoảng 320MB và thời gian xuống ~0,5 giây. Bước lượng tử hóa này là một phần của đặc tả, không phải tối ưu tùy chọn.

**Lưu ý về LLM — đọc kỹ chỗ này.** Phải dùng bản **`Instruct-2507`**, không phải `qwen3:4b` gốc. Bản gốc là mô hình *lai có chế độ suy nghĩ*: nó tự phát ra khối `<think>…</think>` dài trước khi trả lời, cộng thêm 5–10 giây mỗi lượt và phá ràng buộc JSON schema. Lý do đầy đủ ở [`MODEL-RESEARCH.md`](./MODEL-RESEARCH.md) mục 2.

Nếu Ollama có sẵn tag tương ứng thì dùng luôn; không thì tải GGUF từ `unsloth/Qwen3-4B-Instruct-2507-GGUF` và nạp qua Modelfile. Sau khi nạp, chạy `ollama show` để xác nhận đúng `Q4_K_M`, ghi digest vào `docs/LICENSES.md`, và **kiểm tra đầu ra không còn khối `<think>`**.

Nếu vì lý do nào đó phải dùng bản lai, bắt buộc tắt chế độ suy nghĩ và kiểm tra lại đầu ra.

---

## 4. Ngân sách VRAM — 6GB

| Thành phần | VRAM |
|---|---|
| Qwen3-4B `Q4_K_M` | 2,5 GB |
| KV cache, `num_ctx = 4096` | 0,4 GB |
| faster-whisper `small` int8 | 0,6 GB |
| CUDA context | 0,3 GB |
| **Tổng** | **3,8 GB** |
| Còn trống | ~2,2 GB (Linux) · ~1,2 GB (Windows, sau khi trừ desktop) |

Ngưỡng cảnh báo: nếu `nvidia-smi` báo dùng quá **5,2 GB** thì có gì đó sai — kiểm tra `num_ctx` và `OLLAMA_KEEP_ALIVE` trước tiên.

---

## 5. Cấu hình — giá trị chốt

| Biến | Giá trị | Vì sao |
|---|---|---|
| `OLLAMA_KEEP_ALIVE` | `30m` | Giữ model thường trú trong buổi học |
| `OLLAMA_NUM_PARALLEL` | `1` | Một người dùng, tránh nhân đôi KV cache |
| `GGML_CUDA_FORCE_MMQ` | `1` | Ép nhân DP4A, thứ Pascal làm tốt |
| `num_ctx` (Ollama) | `4096` | Hội thoại 10 lượt không tới 1500 token |
| `num_gpu` (Ollama) | `99` | Offload toàn bộ lớp |
| `temperature` | `0.3` | Hội thoại A0 cần đoán trước được, không cần sáng tạo |
| `WHISPER_MODEL` | `small` | |
| `WHISPER_COMPUTE_TYPE` | `int8` | **Không phải `int8_float16`** — Pascal |
| `WHISPER_LANGUAGE` | `en` | Cố định, đừng để tự nhận diện |
| `OMP_NUM_THREADS` | `5` | Chừa 1 nhân cho hệ điều hành |
| `TTS_SPEED` | `0.85` | Tốc độ mặc định cho A0 |
| `GOP_PCT_WARN` / `GOP_PCT_BAD` | `25` / `10` | Phân vị, hiệu chỉnh từ 20 câu tự thu |

---

## 6. Cổng, thư mục, ranh giới

```
:3000   Next.js            (chạy thẳng trên máy)
:8000   speech-service     (Docker, GPU + CPU)
:11434  Ollama             (Docker, GPU)

./data/app.db              SQLite — backup = copy file này
./data/audio/              Audio người dùng, tự xóa sau 90 ngày
./data/tts-cache/          TTS đã sinh, khóa = hash(text + voice + speed)
./content/*.yaml           Nội dung bài học, nguồn sự thật
```

Bốn ranh giới bắt buộc giữ (chi tiết ở `PLAN-LOCAL.md` mục 10):

1. Mọi lời gọi STT / chấm phát âm / TTS đi qua interface **`SpeechProvider`**.
2. Prisma `provider = "sqlite"`, tránh cú pháp SQL riêng của SQLite.
3. Mọi đường dẫn audio đi qua module **`storage`**, không rải `fs.writeFile`.
4. Nội dung ở **`content/*.yaml`**, không nằm trong code.

---

## 7. Ngưỡng nghiệm thu

### Buổi tối số 0 — ba phép thử trước khi viết code

| Phép thử | Đạt |
|---|---|
| LLM sinh token | **≥ 15 tok/s** (kỳ vọng 20–25). Dưới 10 là sai cấu hình offload. **Kiểm tra luôn: đầu ra không có khối `<think>`** |
| faster-whisper `small` int8 chạy khi Ollama đã nạp model | Tổng VRAM **≤ 5,2 GB**, không OOM |
| GOP trên 2 bản ghi cùng một câu — một đúng, một cố tình sai | Điểm âm vị bị đọc sai **thấp hơn rõ rệt** so với các âm còn lại |

Cả ba đạt thì bắt đầu. Không đạt thì sửa trước, đừng xây tiếp lên nền lỗi.

**Phép thử phụ, không chặn tiến độ:** thử `qwen3.5:4b` ở chế độ chỉ-văn-bản. Chạy trơn và nhanh hơn Instruct-2507 thì đổi; trục trặc thì bỏ qua, đừng mất thời gian. Xem `MODEL-RESEARCH.md` mục 3.

### Bốn cuối tuần

| Mốc | Nghiệm thu |
|---|---|
| **CT1** — Nghe và nói | Nói một câu, thấy nó hiện ra thành chữ; bấm nút nghe được giọng mẫu |
| **CT2** — Chấm phát âm | Đọc sai cố ý một từ, đúng từ đó đỏ lên. Ngưỡng đã hiệu chỉnh từ 20 câu của chính mình |
| **CT3** — Hội thoại | Chạy trọn 6 lượt tình huống gọi cà phê, không bí, không câu nào quá 12 từ |
| **CT4** — SRS | Thẻ đến hạn hiện ra, ôn xong trong 5 phút, lịch ôn tiếp theo đúng theo FSRS |

Độ trễ mục tiêu mỗi lượt: **p95 ≤ 3 giây**. Nếu vượt, xử lý theo thứ tự: bật tái dùng KV cache → sinh sẵn TTS cho câu kịch bản → hạ Whisper xuống `base`.

---

## 8. Chốt không làm

Khóa lại để khỏi bàn lại giữa chừng:

- Không mua GPU. Xem lại quyết định này chỉ khi đụng một trong bốn bức tường ở `PLAN-LOCAL.md` mục 10.1.
- Không dùng vLLM, không dùng AWQ/GPTQ. Pascal không hỗ trợ.
- Không cài PyTorch vào `speech-service`. CTranslate2 và ONNX Runtime là đủ.
- Không huấn luyện đầu hồi quy GOPT. Dùng GOP thô với ngưỡng tự hiệu chỉnh.
- Không Postgres, không Redis, không S3, không auth, không CI/CD.
- Không container hóa Next.js.
- Không viết đủ 30 tình huống trước khi bắt đầu học. Ba tình huống là đủ để chạy CT3.

---

## 9. Khác biệt theo hệ điều hành

**Linux** — đường đi thẳng nhất. Cài NVIDIA Container Toolkit, `docker compose up -d speech ollama`, `pnpm dev`. Hết.

**Windows** — Docker Desktop với backend WSL2, GPU đi qua driver trên host. Trừ thêm ~1GB VRAM cho desktop và tắt tăng tốc phần cứng ở trình duyệt dùng để mở app. Nếu vấp rắc rối GPU trong Docker, chuyển sang phương án cài Python và Ollama **thẳng trong WSL2, không dùng Docker** — đổi cách cô lập môi trường, không mất gì trong đặc tả này.
