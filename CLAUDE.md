# CommunicationLearning

App luyện nói tiếng Anh cho người Việt mới bắt đầu (A0–A1), **chạy hoàn toàn cục bộ**
bằng mô hình mã nguồn mở. Người dùng: đúng một người (tác giả). Không có auth, không đa người dùng.

**Giao diện và tài liệu viết bằng tiếng Việt. Code, tên biến, commit message tiếng Anh hoặc tiếng Việt không dấu đều được — nhưng comment giải thích *vì sao* thì viết tiếng Việt.**

---

## Phần cứng đích — đây là ràng buộc, không phải gợi ý

**Ryzen 5 5600 · GTX 1060 6GB · 32GB RAM · Windows**

GTX 1060 là kiến trúc **Pascal, compute capability 6.1**. Ba hệ quả chi phối mọi quyết định:

1. **Không có Tensor Core.** FP16 chạy ~1/64 tốc độ FP32. Không có BF16.
2. **Có DP4A**, nên nhân INT8 kiểu `Q4_K` của llama.cpp chạy tốt.
3. **CUDA 13 đã bỏ Pascal.** Bám CUDA 12.x, wheel `cu12x`, driver nhánh 550.

### Không bao giờ đề xuất những thứ này

| Cấm | Lý do |
|---|---|
| **vLLM** | Yêu cầu CC ≥ 7.0, card này là 6.1 |
| AWQ / GPTQ với nhân Marlin | Cần Ampere trở lên |
| `compute_type="int8_float16"` | Đường FP16 chậm hơn trên Pascal. Phải là `"int8"` |
| CUDA 13.x, PyTorch bản `cu13` | Đã bỏ Pascal |
| Cài PyTorch vào `services/speech` | Runtime dùng CTranslate2 + ONNX Runtime. Torch chỉ có trong container `tools` dùng một lần |
| Model LLM > 3,5GB (Linux) / 2,8GB (Windows) | Không vừa khe VRAM |
| Postgres, Redis, S3, auth, CI/CD | Thừa cho một người dùng |
| Container hóa Next.js | Nó là thứ sửa liên tục, `pnpm dev` chạy thẳng |

### Ngân sách VRAM 6GB — kiểm tra trước khi thêm bất cứ gì lên GPU

| | |
|---|---|
| LLM `Q4_K_M` | 2,5 GB |
| KV cache (`num_ctx=4096`) | 0,4 GB |
| faster-whisper `small` int8 | 0,6 GB |
| CUDA context | 0,3 GB |
| Desktop Windows + trình duyệt | ~1,0 GB |
| **Tổng** | **~4,8 / 6 GB** |

Ngưỡng cảnh báo: `nvidia-smi` quá **5,5 GB** là có gì đó sai.
Cần thêm VRAM thì **đổi LLM sang MiniCPM5-1B (~0,7GB) trước**, đừng hạ Whisper.

---

## Kiến trúc — ba process, ba nơi

| Process | Chạy ở đâu | Ghi chú |
|---|---|---|
| `apps/web` — Next.js 15 | **Native Windows**, `pnpm dev` | UI + API routes + Prisma/SQLite. Sở hữu toàn bộ đĩa |
| `services/speech` — FastAPI | **Docker Desktop (WSL2)** | Whisper, wav2vec2+GOP, Kokoro. **Stateless** |
| Ollama | **Native Windows** | GPU đi thẳng qua driver, không qua WSL2/Docker. Chưa dùng tới cuối tuần 3 |

**`speech-service` không đụng vào đĩa.** Nhận bytes audio trong thân request, trả JSON hoặc
bytes audio. Bind mount từ ổ Windows vào WSL2 rất chậm nên đã bỏ hẳn. Chỉ có một named
volume duy nhất cho cache trọng số model.

---

## Lệnh

```bash
pnpm install
pnpm dev                # Next.js, localhost:3000
pnpm build              # phải xanh trước khi coi là xong
pnpm typecheck
pnpm db:push            # đẩy schema Prisma sang SQLite

pnpm speech:up          # docker compose up -d speech
pnpm speech:logs
docker compose -f docker/compose.yml --profile tools run --rm tools   # xuất ONNX, một lần

cd services/speech && python -m pytest tests/ -q                       # test thuật toán GOP
```

---

## Năm ranh giới — giữ nghiêm, đây là thứ khiến đổi model về sau không phải viết lại

1. **`apps/web/src/lib/speech.ts`** — `SpeechProvider`. Mọi lời gọi STT / chấm phát âm / TTS.
2. **`LlmProvider`** (chưa viết, cuối tuần 3) — mọi lời gọi LLM. Tự chuẩn hoá đầu ra,
   ép JSON bằng **GBNF grammar** chứ không dùng cơ chế riêng của backend. Prompt để trong
   `prompts/*.md`, không nhúng chuỗi vào code.
3. **Prisma `provider = "sqlite"`** — tránh cú pháp SQL riêng của SQLite.
4. **`apps/web/src/lib/storage.ts`** — mọi thứ chạm đĩa. Không rải `fs.writeFile`.
5. **Nội dung ở `content/*.yaml`**, không nằm trong code.

---

## Quy ước riêng của dự án

- **Thông điệp lỗi viết cho người dùng, bằng tiếng Việt, và nói rõ phải làm gì.**
  Ví dụ đang có: *"Không kết nối được speech-service ở http://127.0.0.1:8000.
  Đã chạy `pnpm speech:up` chưa?"* — chứ không phải "Error 502".
- **Mọi bảng điểm phải có `modelVersion`.** Đổi model chấm mà không biết điểm cũ từ đâu ra
  thì mọi biểu đồ tiến bộ đều vô nghĩa.
- **Độ tin cậy thấp thì không hiện điểm.** Im lặng tốt hơn sai.
- **Điểm của một từ lấy MIN các âm vị**, không lấy trung bình — một âm sai đủ làm cả từ nghe sai.
- **Suy giảm êm, không sập.** Model thiếu → trả 503 kèm đúng lệnh cần chạy. Whisper không nạp
  được trên CUDA → tự lùi về CPU.
- **Không tự ý mở rộng phạm vi.** Mỗi cuối tuần ra một thứ dùng được, không phải một tầng
  trừu tượng cho tương lai chưa chắc tới.

---

## Trạng thái

**Xong:** cuối tuần 1 (ghi âm → chép lời → nghe giọng mẫu) và cuối tuần 2 (chấm phát âm
theo âm vị, ngưỡng hiệu chỉnh từ 20 câu của chính người dùng).

**Tiếp theo — cuối tuần 3: hội thoại với LLM.**

- Ollama native Windows + **`Qwen3-4B-Instruct-2507` `Q4_K_M`**.
  **Bắt buộc bản `Instruct-2507`, không phải `qwen3:4b` gốc** — bản gốc là mô hình lai có
  chế độ suy nghĩ, tự phát khối `<think>` dài, cộng 5–10 giây mỗi lượt và phá JSON schema.
- **Kiến trúc lai:** mỗi tình huống là một đồ thị trạng thái viết tay có sẵn câu mẫu.
  LLM chỉ làm ba việc hẹp — phân loại câu người học vào một nhánh, diễn đạt lại câu mẫu,
  sửa lỗi ngữ pháp. Đừng bắt model 4B làm việc của model 200B.
- **`eval/cases.json`** — 30–50 ví dụ `{câu người học nói, nhánh đúng, câu sửa mong đợi}`
  cộng script in ra tỉ lệ phân nhánh đúng. Làm cùng lúc, không để sau.
- Sau đó so **MiniCPM5-1B** với Qwen3-4B bằng eval đó. Đạt ≥ 95% thì đổi, lấy lại 1,8GB VRAM.

**Cuối tuần 4:** flashcard FSRS qua `ts-fsrs`.

---

## Tài liệu — đọc trước khi sửa gì lớn

| File | Nội dung |
|---|---|
| `docs/SPEC.md` | **Đặc tả đã chốt.** Phiên bản ghim, tên model, giá trị cấu hình, ngưỡng nghiệm thu |
| `docs/PLAN-LOCAL.md` | Lý do đằng sau từng lựa chọn |
| `docs/MODEL-RESEARCH.md` | Vì sao chọn model này, vì sao loại những model kia |
| `docs/SETUP-WINDOWS.md` | Cách chạy, cách gỡ rối |
| `docs/PLAN.md` | Đích đến nhiều người dùng — **không phải việc của bây giờ** |

---

## Trước khi báo là xong

1. `pnpm typecheck` và `pnpm build` phải xanh.
2. Sửa `services/speech/app/gop.py` thì `pytest` phải xanh.
3. Chạy thật và thử **cả đường lỗi**, không chỉ đường thành công.
4. Nói rõ cái gì đã kiểm chứng và cái gì chưa. Không suy đoán rồi trình bày như đã chạy.
