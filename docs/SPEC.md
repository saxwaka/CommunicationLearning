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

Năm ranh giới bắt buộc giữ (chi tiết ở `PLAN-LOCAL.md` mục 10):

1. Mọi lời gọi STT / chấm phát âm / TTS đi qua interface **`SpeechProvider`**.
2. Mọi lời gọi LLM đi qua interface **`LlmProvider`** — xem mục 6.1.
3. Prisma `provider = "sqlite"`, tránh cú pháp SQL riêng của SQLite.
4. Mọi đường dẫn audio đi qua module **`storage`**, không rải `fs.writeFile`.
5. Nội dung ở **`content/*.yaml`**, không nằm trong code.

### 6.1 Đổi model về sau — cái gì dễ, cái gì không

Đổi **file model** thì dễ: một biến môi trường, một lệnh `pull`. Nhưng có bốn thứ rò rỉ ra ngoài lớp đó, và nếu không chặn từ đầu thì mỗi lần đổi model là một buổi tối gỡ rối.

| Thứ rò rỉ | Chặn bằng |
|---|---|
| **Prompt** — mỗi dòng model phản ứng khác nhau với cùng một chỉ dẫn | Để prompt trong `prompts/*.md`, không nhúng chuỗi trong code. Đổi model thì sửa file, không sửa logic |
| **Cách ép JSON** — mỗi backend một kiểu (`format: json`, JSON schema, GBNF) | Dùng **GBNF grammar**, thứ độc lập với model. Ra khỏi `LlmProvider` là **validate bằng Zod**, sai schema thì rơi về câu mẫu viết tay của nút trạng thái |
| **Đầu ra thừa** — khối `<think>` là một ví dụ, model khác có kiểu khác | `LlmProvider` **chuẩn hóa đầu ra**: cắt mọi thứ ngoài schema rồi mới trả ra. Không để lớp nghiệp vụ biết model nào đang chạy |
| **Ngân sách VRAM** — không phải vấn đề code | Model thay thế phải nằm trong **≤ 3,5GB** (Linux) / **≤ 2,8GB** (Windows). Vượt là không đổi được, dù code sạch tới đâu |

**Thứ khó nhất không nằm trong bảng trên:** đổi model thì dễ, nhưng **biết được model mới tốt hơn hay tệ hơn** thì không — trừ khi có cái để đo.

Vì vậy ở **cuối tuần 3**, khi dựng tầng hội thoại, làm luôn `eval/cases.json`: **30–50 ví dụ** dạng `{câu người học nói, nhánh đúng, câu sửa mong đợi}` cộng một script chạy hết và in ra tỉ lệ phân nhánh đúng. Mất khoảng một tiếng.

Có nó rồi thì đổi model là **một thí nghiệm 10 phút có con số ở cuối**, thay vì một cảm giác mơ hồ rằng "hình như lần này nói hay hơn". Đây mới là thứ khiến câu "đổi model sau cũng được" thành sự thật.

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
| **CT3** — Hội thoại | Chạy trọn 6 lượt tình huống gọi cà phê, không bí, không câu nào quá 12 từ. **Kèm `eval/cases.json` 30–50 ví dụ và script đo tỉ lệ phân nhánh đúng** |
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

## 9. Windows — chốt cách chạy

Máy đích chạy **Windows**. Ba process đặt ở ba nơi khác nhau, và đây là lựa chọn có chủ đích:

| Process | Chạy ở đâu | Vì sao |
|---|---|---|
| **Ollama** | **Native Windows** (trình cài đặt chính thức) | GPU đi thẳng qua driver Windows, **không qua WSL2, không qua Docker**. Bớt được hẳn một lớp — và đây là lớp hay hỏng nhất |
| **speech-service** | **Docker Desktop** (backend WSL2) | Mớ CUDA + cuDNN + ctranslate2 vẫn nên nhốt trong container |
| **Next.js** | **Native Windows**, `pnpm dev` | Thứ sửa liên tục, không container hóa |

### 9.1 Ngân sách VRAM trên Windows

Desktop Windows và trình duyệt ăn thêm VRAM, nên bảng ở mục 4 phải trừ đi:

| | |
|---|---|
| Stack (LLM + KV + Whisper + CUDA context) | 3,8 GB |
| Desktop Windows + DWM | ~0,5 GB |
| Trình duyệt có tăng tốc phần cứng | ~0,5 GB |
| **Tổng** | **~4,8 / 6 GB** — còn ~1,2 GB đệm |

**Bắt buộc:** tắt tăng tốc phần cứng ở trình duyệt dùng để mở app (Chrome/Edge: Settings → System → tắt *Use graphics acceleration when available*). Việc này trả lại ~0,5GB và là cách rẻ nhất để nới đệm.

Ngưỡng cảnh báo trên Windows: `nvidia-smi` báo quá **5,5 GB** là cần xem lại.

**Nếu VRAM căng, đòn bẩy lớn nhất là đổi LLM, không phải hạ Whisper.** MiniCPM5-1B chiếm ~0,7GB thay vì ~2,5GB, đưa tổng stack từ 4,8 xuống ~3,0 GB. Đây là việc thử ở cuối tuần 3 khi đã có `eval/cases.json` để đo — xem [`MODEL-RESEARCH.md`](./MODEL-RESEARCH.md).

### 9.2 Không bind mount thư mục audio

Bind mount từ ổ Windows vào container WSL2 đi qua lớp dịch file rất chậm. Nên **bỏ hẳn**:

- `speech-service` **không đụng vào đĩa** — nhận bytes audio trong thân request, trả JSON hoặc bytes audio.
- Next.js sở hữu toàn bộ đĩa: `data/app.db`, `data/audio/`, `data/tts-cache/` đều nằm trên ổ Windows, do Node ghi trực tiếp.
- Chỉ có **một** volume Docker: cache trọng số model, và nó là **named volume** nằm trong WSL2 chứ không phải thư mục Windows.

Đổi lại chút băng thông localhost (file audio 5 giây chỉ ~50KB) để bỏ hẳn điểm chậm nhất của Docker trên Windows. Đây cũng khiến `speech-service` thành stateless — dễ khởi động lại, dễ thay thế.

### 9.3 Giới hạn RAM cho WSL2

Docker Desktop qua WSL2 có thể ngốn dần RAM. Tạo `C:\Users\<tên>\.wslconfig`:

```ini
[wsl2]
memory=10GB
processors=6
swap=2GB
```

10GB là đủ rộng cho `speech-service`, và chừa phần lớn 32GB cho Windows, trình duyệt, Next.js và Ollama.

### 9.4 Vặt nhưng hay mất thời gian

- **CRLF.** Repo có script chạy trong container Linux — cần `.gitattributes` ép `LF` cho `*.sh`, nếu không container sẽ báo lỗi kiểu `bad interpreter`.
- **`OLLAMA_KEEP_ALIVE`** trên Windows đặt bằng biến môi trường hệ thống (System Properties → Environment Variables), rồi khởi động lại Ollama. Đặt trong terminal chỉ có tác dụng cho phiên đó.
- **Ollama nghe ở `127.0.0.1:11434`** trên Windows, còn Next.js cũng chạy native Windows nên gọi thẳng được. Riêng `speech-service` trong container thì gọi ra host bằng `host.docker.internal` — nhưng theo mục 9.2 nó không cần gọi Ollama, nên không phát sinh vấn đề.

### 9.5 Nếu vẫn vấp GPU trong Docker

Pascal + WSL2 + CUDA 12.x là tổ hợp ít người kiểm chứng. Nếu `speech-service` không thấy GPU sau khi đã cài NVIDIA Container Toolkit trong WSL2:

1. Thử trước: `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi`.
2. Không được thì **bỏ Docker cho speech-service**, cài Python 3.12 thẳng trong Ubuntu của WSL2 và chạy uvicorn ở đó. Đổi cách cô lập môi trường, không mất gì trong đặc tả này.
3. Vẫn không được thì cho `speech-service` **chạy Whisper trên CPU** (`WHISPER_DEVICE=cpu`). Chậm hơn khoảng 3 lần nhưng vẫn dùng được, và không chặn tiến độ.
