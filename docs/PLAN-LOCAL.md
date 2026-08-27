# Giai đoạn 0 — Bản chạy trên máy cá nhân, phục vụ một người

> Kế hoạch thi công cho cấu hình **Ryzen 5 5600 · GTX 1060 6GB · 32GB RAM**, người dùng duy nhất là tác giả.
> Lập ngày 2026-08-27. Đây là bản **thay thế** cho v1.1 ở giai đoạn hiện tại, không phải bản rút gọn tạm bợ:
> mọi lựa chọn dưới đây đều là lựa chọn đúng cho ràng buộc thật, và được viết sao cho lên quy mô sau này
> không phải đập đi làm lại. Kế hoạch nhiều người dùng nằm ở [`PLAN.md`](./PLAN.md).

---

## 1. Đọc đúng phần cứng trước khi lên kế hoạch

| Thành phần | Con số | Ý nghĩa thực tế |
|---|---|---|
| Ryzen 5 5600 | 6 nhân / 12 luồng, Zen 3, AVX2 | Đủ mạnh để gánh STT, chấm phát âm và TTS **trên CPU** |
| GTX 1060 6GB | Pascal, **compute capability 6.1**, 192 GB/s | Ràng buộc lớn nhất. Xem bên dưới |
| RAM 32GB | | Dư dả — đây là lợi thế lớn, cho phép đẩy việc từ GPU sang CPU thoải mái |

### Ba giới hạn của Pascal quyết định toàn bộ stack

1. **Không có Tensor Core.** FP16 trên GP106 chạy ở tốc độ khoảng 1/64 so với FP32 — nhanh hơn thì không, chỉ tiết kiệm bộ nhớ. Mọi thứ tối ưu cho FP16/BF16 đều mất tác dụng. Không hỗ trợ BF16.
2. **Có DP4A (INT8).** Đây là tin tốt: các nhân int8 kiểu `Q4_K`, `Q5_K` của llama.cpp chạy được tử tế trên Pascal.
3. **CUDA 13.0 đã bỏ hỗ trợ Pascal.** Phải bám **CUDA 12.x**, và cài PyTorch/ONNX Runtime bản build cho `cu12x`. Đây cũng là tín hiệu: card này còn dùng được vài năm nữa, nhưng nằm trên đường bị khai tử.

### Cái gì trong v1.1 không chạy được trên máy này

| Trong v1.1 | Vì sao hỏng | Thay bằng |
|---|---|---|
| **vLLM** | Yêu cầu compute capability ≥ 7.0; 1060 là 6.1 | **llama.cpp** (hoặc Ollama bọc ngoài nó) |
| Trọng số AWQ / GPTQ với nhân Marlin | Cần Ampere trở lên | **GGUF `Q4_K_M`** |
| Qwen3-8B | ~5,0GB ở Q4 cộng KV cache → nuốt trọn 6GB, không còn chỗ cho gì khác | **Qwen3-4B** |
| `compute_type="int8_float16"` của faster-whisper | Đường FP16 rất chậm trên Pascal | `compute_type="int8"` (int8 + tích lũy FP32) |
| CUDA 13.x, PyTorch bản cu13 | Đã bỏ Pascal | Bám CUDA 12.x |
| Kiến trúc 3 service + Postgres + Redis + S3 + MinIO | Không sai, chỉ là thừa cho một người | Một app Next.js + hai process Python, SQLite, thư mục trên đĩa |

---

## 2. Ngân sách VRAM — 6GB phải chia làm sao

Mặc định: **LLM và Whisper trên GPU, chấm phát âm và TTS trên CPU.**

| Thành phần | VRAM | Ghi chú |
|---|---|---|
| Qwen3-4B-Instruct `Q4_K_M` | ~2,5 GB | Offload toàn bộ lớp lên GPU |
| KV cache, ngữ cảnh 4096 token | ~0,4 GB | Hội thoại A0 không cần dài hơn |
| faster-whisper `small`, `int8` | ~0,6 GB | Thừa sức cho tiếng Anh đọc chậm |
| CUDA context + phân mảnh | ~0,3 GB | |
| **Tổng** | **~3,8 GB** | Còn dư ~1,5–2 GB đệm |

**Cảnh báo về Windows:** desktop Windows và trình duyệt có tăng tốc phần cứng ăn khoảng **0,5–1 GB VRAM**. Nếu chạy trên Windows, hãy tắt tăng tốc GPU ở trình duyệt dùng để mở app, hoặc trừ sẵn 1GB khỏi bảng trên. Chạy trên Linux thì thoải mái hơn hẳn.

**Nếu muốn thử Qwen3-8B `Q4_K_M`** (~5,0 GB + KV): phải đẩy Whisper xuống CPU, và GPU chỉ còn phục vụ LLM. Làm được, nhưng chất lượng hội thoại A0 tăng không tương xứng với độ chật chội — để dành khi nào đổi card.

### Vì sao đẩy chấm phát âm và TTS xuống CPU là lựa chọn đúng, không phải nhượng bộ

- **wav2vec2 cỡ base** (~95M) chạy ONNX Runtime trên 6 nhân Zen 3 xử lý 5 giây audio trong khoảng nửa giây. Nó chạy **song song** với Whisper trên GPU, nên không cộng vào tổng độ trễ.
- **Kokoro-82M** trên CPU đủ nhanh, và quan trọng hơn: **hầu hết câu đều là cache hit**, vì nội dung có kịch bản. TTS lúc chạy là trường hợp hiếm chứ không phải mặc định.
- 32GB RAM khiến việc này gần như miễn phí. Trong khi 6GB VRAM là tài nguyên khan hiếm nhất — cái gì không bắt buộc phải ở trên đó thì đừng để nó ở đó.

---

## 3. Kiến trúc — ba process, không phải mười hai

```
┌────────────────────────────────────────────────┐
│  Next.js 15 (App Router)                       │
│  UI + API routes + Prisma → SQLite             │  ← một app duy nhất
│  Audio lưu ở  ./data/audio/                    │
└───────────┬──────────────────┬─────────────────┘
            │ localhost:8000   │ localhost:11434
┌───────────▼───────────┐  ┌───▼──────────────────┐
│  speech-service       │  │  Ollama              │
│  FastAPI, Python 3.12 │  │  (llama.cpp bên dưới)│
│                       │  │  Qwen3-4B Q4_K_M     │
│  • faster-whisper GPU │  │  API kiểu OpenAI     │
│  • wav2vec2 GOP  CPU  │  └──────────────────────┘
│  • Kokoro TTS    CPU  │
└───────────────────────┘
```

**Vì sao vẫn tách `speech-service` ra Python** dù chỉ có một người dùng: hệ sinh thái mô hình nằm ở Python, và tách ra nghĩa là nạp model **một lần** lúc khởi động thay vì mỗi request. Đây là tách vì lý do kỹ thuật thật, không phải vì kiến trúc đẹp.

**Vì sao dùng Ollama thay vì gọi thẳng `llama-server`:** nó quản lý model, tự nạp/giải phóng, và cho sẵn API kiểu OpenAI. Khi cần vắt kiệt hiệu năng thì chuyển sang `llama-server` với cờ chỉnh tay — đổi một biến môi trường, vì cả hai cùng giao diện.

### Những thứ cố ý bỏ, và điều kiện để đưa lại vào

| Bỏ | Vì sao | Đưa lại khi |
|---|---|---|
| NestJS làm backend riêng | Next.js API routes đủ cho một người | Có app mobile, hoặc cần API dùng chung |
| PostgreSQL | SQLite nhanh hơn cho một người dùng, và là một file | Có người dùng thứ hai ghi đồng thời |
| Redis + BullMQ | Không có việc nền nào đáng xếp hàng | Xử lý hàng loạt, hoặc nhiều người dùng |
| S3 / MinIO | Thư mục trên đĩa, backup bằng cách copy | Cần truy cập từ nhiều máy |
| Auth, hạn mức, chống lạm dụng | Chỉ có một người, và người đó là bạn | Mở cho người ngoài — **bắt buộc trước khi mở** |
| Docker Compose nhiều service | `pnpm dev` cộng hai lệnh là xong | Deploy lên máy khác |
| Huấn luyện đầu hồi quy GOPT | Xem mục 5 | Cần điểm số so được với chuẩn ngành |
| Streak, XP, thông báo đẩy | Bạn tự biết mình có học hay không | Có người dùng thật cần động lực ngoài |
| CI/CD, giám sát, cảnh báo | Máy ở ngay đây | Chạy trên máy chủ từ xa |

Số thành phần phải vận hành: **từ khoảng mười hai xuống ba.** Đó là khác biệt giữa "dự án cuối tuần làm xong" và "dự án bỏ dở ở tuần thứ năm".

---

## 4. Chọn mô hình cho máy này

| Vai trò | Mô hình | Kích thước | Chạy ở | Giấy phép |
|---|---|---|---|---|
| Hội thoại | **Qwen3-4B-Instruct** `Q4_K_M` (GGUF) | ~2,5 GB | GPU | Apache 2.0 |
| Chép lời | **faster-whisper `small`**, `compute_type="int8"` | ~0,6 GB | GPU | MIT |
| Chấm phát âm | **wav2vec2 base** fine-tune nhận âm vị, ONNX | ~0,4 GB RAM | CPU | Apache 2.0 |
| Giọng đọc | **Kokoro-82M** ONNX | ~0,3 GB RAM | CPU | Apache 2.0 |
| Cắt tiếng nói | **Silero VAD** ONNX | ~0,05 GB | Trình duyệt | MIT |

Toàn bộ đều là giấy phép cho phép thương mại — nếu sau này mở rộng thì không phải thay gì. Vẫn giữ nguyên tắc của v1.1: **không đụng vào XTTS-v2** (Coqui CPML, phi thương mại).

### Mẹo riêng cho Pascal

- Đặt `GGML_CUDA_FORCE_MMQ=1` cho llama.cpp — ép dùng nhân nhân ma trận lượng tử hóa dựa trên DP4A, thứ Pascal làm tốt, thay vì đường FP16.
- Offload **toàn bộ** lớp lên GPU (`num_gpu` đủ lớn trong Ollama). Model 2,5GB nằm gọn trong 6GB; để lại lớp nào trên CPU cũng là mất tốc độ vô ích.
- faster-whisper: **`compute_type="int8"`**, không phải `int8_float16`. Trên Pascal, đường FP16 chậm hơn chứ không nhanh hơn.
- Ngữ cảnh giữ ở 4096. Hội thoại A0 mười lượt không tới 1500 token, và KV cache là thứ ăn VRAM âm thầm nhất.

---

## 5. Chấm phát âm — bản dành cho một người, làm trong ba buổi tối

Đây là chỗ tiết kiệm được nhiều thời gian nhất so với v1.1, và tiết kiệm một cách chính đáng.

**v1.1 cần gì:** huấn luyện đầu hồi quy GOPT trên speechocean762, hiệu chỉnh để điểm số khớp với giáo viên, kiểm chứng tương quan ≥ 0,6. Bốn tuần. Lý do: sản phẩm thương mại phải hiện một con số mà người lạ tin được.

**Bạn cần gì:** biết âm nào mình đọc chưa đúng. Không cần con số so được với chuẩn ngành, không cần thang điểm 0–100 khớp với người chấm.

Nên bỏ hẳn phần huấn luyện, chỉ giữ đường tính GOP thô:

1. Văn bản đích → chuỗi âm vị chuẩn qua `CMUdict`, từ nào thiếu thì `espeak-ng` sinh.
2. wav2vec2 cho xác suất hậu nghiệm từng âm vị theo khung 20ms.
3. Tính GOP: `log P(âm vị đúng) − max log P(âm vị bất kỳ)`.
4. **Tự hiệu chỉnh ngưỡng:** thu 20 câu bạn đọc ở trạng thái tốt nhất, lấy phân bố GOP của chính bạn, đặt ngưỡng ở phân vị 25 và 10 để chia ba mức màu.

Bước 4 chính là chỗ hay: ngưỡng được hiệu chỉnh **cho riêng giọng bạn**, nên còn phù hợp hơn cả một mô hình huấn luyện trên giọng người khác. Và mất khoảng một tiếng.

**Hiển thị:** ba mức màu ở mức từ, bấm vào từ mới xem chi tiết âm vị. Chỗ nào GOP nằm giữa hai ngưỡng thì để trung tính — nguyên tắc "im lặng tốt hơn sai" của v1.1 vẫn giữ nguyên.

---

## 6. Ngân sách độ trễ trên chính máy này

Ước tính cho một lượt nói 5 giây, đã trừ mạng vì tất cả chạy ở localhost:

| Chặng | Ước tính | Ghi chú |
|---|---|---|
| VAD + gửi audio | ~30 ms | localhost |
| STT — Whisper `small` int8, GPU | 400–600 ms | Pascal không có Tensor Core nên chậm hơn card mới |
| Chấm phát âm — CPU | ~500 ms | **Song song** với STT, không cộng vào tổng |
| LLM — nạp prompt | 300–600 ms | Gần như biến mất từ lượt thứ hai nhờ tái dùng KV cache |
| LLM — sinh 20 token | 800–1000 ms | Khoảng 20–25 token/giây với Qwen3-4B Q4 trên 1060 |
| TTS — cache hit | ~50 ms | Trường hợp thường gặp |
| TTS — cache miss, CPU | ~1000 ms | Chỉ với câu AI ứng biến |
| **Tổng thường gặp** | **≈ 1,5–2,5 giây** | |
| **Trường hợp xấu** | **≈ 3,5 giây** | Lượt đầu, câu mới hoàn toàn |

So với ngân sách 1,8 giây của v1.1 thì chậm hơn — nhưng v1.1 giả định GPU đời mới. **Với một người tự luyện thì 2–3 giây là chấp nhận được**, thậm chí còn hợp: người mới học vốn cần vài giây để nghĩ, và khoảng lặng đó không gây khó chịu như trong một cuộc gọi thật.

Ba việc đáng làm nếu thấy chậm, theo thứ tự hiệu quả trên tiền công bỏ ra: bật tái dùng KV cache, sinh sẵn TTS cho toàn bộ câu kịch bản, và hạ Whisper từ `small` xuống `base`.

---

## 7. Lộ trình — bốn cuối tuần, không phải mười sáu tuần

Mỗi mốc là một thứ **dùng được**, không phải một thứ "đã xong nhưng chưa chạy".

### Cuối tuần 1 — Nghe được và nói được
Next.js + Prisma/SQLite, một trang duy nhất. Ghi âm trên trình duyệt, gửi lên `speech-service`, nhận lại bản chép lời, bấm nút nghe giọng mẫu. Chưa có AI, chưa có bài học.
**Xong khi:** bạn nói một câu và thấy nó hiện ra thành chữ.

### Cuối tuần 2 — Biết mình sai ở đâu
Đường GOP, tự hiệu chỉnh ngưỡng bằng 20 câu của chính bạn, tô màu từng từ, bấm vào từ xem âm vị.
**Xong khi:** đọc sai cố ý một từ và thấy đúng từ đó đỏ lên.

### Cuối tuần 3 — Nói chuyện được
Ollama + Qwen3-4B, đồ thị trạng thái cho 3 tình huống đầu, ràng buộc JSON schema, gợi ý câu trả lời.
**Xong khi:** chạy trọn một hội thoại 6 lượt về việc gọi cà phê mà không bí.

### Cuối tuần 4 — Nhớ được thứ vừa nói
FSRS qua `ts-fsrs`, tự sinh thẻ cuối phiên, hai loại thẻ (nghe→nghĩa, nghĩa→nói).
**Xong khi:** thẻ hôm nay đến hạn và ôn xong trong năm phút.

### Sau đó — bồi nội dung dần
Không có deadline. Mỗi lần rảnh thì thêm một tình huống. Sinh nháp bằng chính Qwen3-4B hoặc bằng trợ lý nào bạn đang dùng, tự sửa lại, commit vào `content/*.yaml`, chạy script seed và sinh TTS cache.

**Ưu tiên đúng:** cuối tuần 2 quan trọng hơn cuối tuần 3. Chấm phát âm là thứ bạn không tự làm được cho mình; còn hội thoại thì chưa có AI bạn vẫn tự đọc to được. Nếu chỉ có thời gian cho một nửa kế hoạch, hãy làm nửa đầu.

---

## 8. Chi phí

Tiền mặt: **0 đồng.** Phần cứng đã có, mọi mô hình đều tải miễn phí.

Điện: GTX 1060 khi suy luận theo đợt tiêu tốn khoảng 100–120W, nhưng chỉ vài giây mỗi lượt. Học 20 phút mỗi ngày thì phần điện phát sinh vào cỡ vài nghìn đồng một tháng.

**Một điều nên nói thẳng:** với đúng một người dùng, gọi API thương mại cũng chỉ tốn khoảng 1–3 USD mỗi tháng. Nghĩa là **lý do tự host ở đây không phải tiết kiệm tiền** — mà là chạy được khi không có mạng, dữ liệu giọng nói không đi đâu cả, tự do thử nghiệm không lo hóa đơn, và học được cách các mô hình này hoạt động. Đó là những lý do chính đáng. Chỉ đừng tự thuyết phục mình rằng đang tiết kiệm, vì không phải.

---

## 9. Rủi ro thật của bản này

| Rủi ro | Cách xử lý |
|---|---|
| **Cài đặt CUDA/PyTorch cho Pascal mất cả buổi** | Ghim CUDA 12.x, dùng wheel `cu12x`. Làm việc này **đầu tiên**, trước khi viết dòng code sản phẩm nào |
| Hết VRAM khi cả LLM và Whisper cùng chạy | Ngân sách ở mục 2 đã chừa đệm. Nếu vẫn OOM: hạ Whisper xuống `base`, hoặc đẩy hẳn Whisper sang CPU |
| Qwen3-4B lặp lại hoặc lạc đề | Đồ thị trạng thái cộng câu mẫu viết tay đã là lưới an toàn. Ràng buộc JSON schema là bắt buộc, không phải tùy chọn |
| **Làm xong rồi không dùng** | Rủi ro lớn nhất của bản này, lớn hơn mọi rủi ro kỹ thuật. Cách chống: cuối tuần 1 phải ra được thứ dùng được ngay, và tự dùng nó trong lúc xây phần còn lại |
| Nội dung cạn sau hai tuần | Chấp nhận. Thêm dần, không cố viết đủ 30 tình huống trước khi bắt đầu học |
| Card nằm trên đường bị khai tử | CUDA 13 đã bỏ Pascal. Ghim phiên bản và đừng nâng cấp bừa. Còn dùng tốt vài năm nữa |

---

## 10. Viết sao để sau này không phải đập đi

Bốn ranh giới cần giữ ngay từ đầu, mỗi cái tốn vài phút bây giờ và tiết kiệm vài ngày sau này:

1. **Một interface `SpeechProvider`** che mọi lời gọi STT / chấm phát âm / TTS. Đổi model, đổi sang API, đổi máy — sửa một file.
2. **Prisma với `provider = "sqlite"`.** Chuyển sang Postgres là đổi một dòng `datasource` cộng chạy lại migration. Chỉ cần tránh dùng cú pháp SQL riêng của SQLite.
3. **Đường dẫn audio đi qua một module `storage`** thay vì rải `fs.writeFile` khắp nơi. Đổi sang S3 là thay phần thân module đó.
4. **Nội dung nằm trong `content/*.yaml`, không nằm trong code.** Đây cũng là thứ khiến việc thêm tình huống lúc rảnh trở nên dễ chịu.

Không cần làm gì hơn thế. Mọi trừu tượng khác ở giai đoạn này đều là chi phí trả trước cho một tương lai có thể không tới.

---

## 11. Ba việc làm trước tiên

1. **Dựng được Ollama chạy Qwen3-4B `Q4_K_M` trên 1060, và đo tốc độ sinh token thật.** Nếu ra dưới 10 token/giây thì có gì đó sai ở cấu hình offload — sửa trước khi đi tiếp. Kỳ vọng 20–25 token/giây.
2. **Chạy faster-whisper `small` với `compute_type="int8"` trên một file ghi âm của chính bạn**, xem VRAM chiếm bao nhiêu khi Ollama đang nạp sẵn model. Đây là phép thử ngân sách VRAM ở mục 2.
3. **Chạy thử GOP trên hai bản ghi cùng một câu** — một đọc bình thường, một cố tình đọc sai vài âm — xem điểm thô có phân biệt được không. Nếu có, cả hướng đi đứng vững.

Ba việc này gói gọn trong một buổi tối và trả lời được câu hỏi quan trọng nhất: *máy này có kham nổi không.* Biết trước khi viết code thì rẻ hơn nhiều.
