# Kế hoạch xây dựng web học giao tiếp tiếng Anh

> Tài liệu định hướng sản phẩm & kỹ thuật cho dự án **CommunicationLearning**.
> Phiên bản 1.1 — cập nhật 2026-08-27. Thay đổi so với v1.0: **toàn bộ mô hình AI chuyển sang
> mã nguồn mở, tự host**. Kéo theo thay đổi ở kiến trúc, lộ trình (12 → 16 tuần) và cơ cấu chi phí.
>
> ⚠️ **Đây là kế hoạch cho bản nhiều người dùng, chạy trên GPU đời mới (Ampere trở lên).**
> Bản đang thi công hiện tại là [`PLAN-LOCAL.md`](./PLAN-LOCAL.md) — chạy trên máy cá nhân
> (Ryzen 5 5600 + GTX 1060 6GB), phục vụ một người. Tài liệu này là đích đến, không phải việc của tuần này.

---

## 1. Tóm tắt

Xây dựng một web app giúp **người Việt mới bắt đầu (A0–A1)** dám mở miệng nói tiếng Anh, thông qua hai vòng lặp học tập bổ trợ nhau:

1. **Nói với AI** — hội thoại theo tình huống với giọng nói, được chấm phát âm tới từng từ/âm vị và sửa lỗi ngay.
2. **Flashcard SRS** — ghi nhớ mẫu câu & từ vựng vừa nói bằng thuật toán lặp lại ngắt quãng (FSRS).

Điểm khác biệt: mọi thứ được thiết kế cho **người sợ nói**. Câu ngắn, có gợi ý sẵn, có thể bấm nghe chậm, không bao giờ bị "bí" giữa cuộc hội thoại.

**Toàn bộ AI chạy trên hạ tầng của mình bằng mô hình mã nguồn mở** — không gọi API bên thứ ba. Không có dữ liệu giọng nói của người học rời khỏi máy chủ, chi phí biên gần bằng 0 sau khi đã trả tiền GPU, và không bị nhà cung cấp đổi giá hay ngừng dịch vụ.

### Quyết định nền tảng

| Hạng mục | Lựa chọn |
|---|---|
| Đối tượng | Người mới bắt đầu A0–A1, giao diện tiếng Việt |
| MVP | Hội thoại AI có chấm phát âm + Flashcard SRS |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | NestJS (Node 22) + Prisma + PostgreSQL 16 + Redis/BullMQ |
| Tầng AI | Python (FastAPI) tự host: vLLM + faster-whisper + wav2vec2-GOP + Kokoro |
| Hạ tầng | Docker Compose trên VPS + **một máy GPU 20–24GB**, object storage S3-compatible |
| Giấy phép | Chỉ dùng mô hình cho phép thương mại — xem mục 7 |

### Vì sao đi hướng mã nguồn mở

| Được | Mất |
|---|---|
| Chi phí biên gần 0 — thêm người dùng không thêm hóa đơn | Chi phí cố định GPU ngay từ người dùng đầu tiên |
| Dữ liệu giọng nói không rời hạ tầng của mình | Phải tự vận hành, tự giám sát, tự vá |
| Độ trễ thấp hơn — không có round-trip mạng ra ngoài | Tốn thêm **4–6 tuần R&D** cho phần chấm phát âm |
| Không bị đổi giá, đổi điều khoản, ngừng model | Chất lượng mô hình nhỏ kém hơn model thương mại lớn |
| Tự tinh chỉnh cho giọng Việt bằng dữ liệu của mình | Cần người biết ML trong nhóm |

**Điểm hòa vốn:** ở 1.000 người dùng hoạt động, tự host ≈ 400 USD/tháng so với ≈ 600 USD/tháng khi dùng API — chênh lệch chưa đáng kể. Lợi thế thật sự xuất hiện từ **khoảng 5.000 người dùng trở lên**, khi hóa đơn API tăng tuyến tính còn chi phí GPU gần như đứng yên. Nói cách khác, đây là lựa chọn đánh đổi **thời gian kỹ thuật lấy biên lợi nhuận về sau và quyền tự chủ** — hợp lý nếu xác định làm dài hạn, không hợp lý nếu chỉ muốn kiểm chứng ý tưởng trong 6 tuần.

---

## 2. Người dùng & bài toán

### Chân dung người học

**Minh, 26 tuổi, nhân viên văn phòng.** Học tiếng Anh 7 năm ở trường, đọc hiểu tạm được nhưng chưa từng nói trọn một câu với người nước ngoài. Sợ sai, sợ bị cười. Có 15–20 phút mỗi tối, học trên điện thoại.

### Nỗi đau cần giải quyết

| Nỗi đau | Cách sản phẩm xử lý |
|---|---|
| Không có ai để nói cùng | AI luôn sẵn sàng, không phán xét, không tốn tiền gia sư |
| Không biết mình nói sai chỗ nào | Chấm điểm phát âm theo từng âm vị + phát lại giọng mẫu |
| Bí từ giữa chừng rồi bỏ cuộc | Luôn hiện 2–3 gợi ý câu trả lời để chọn hoặc đọc theo |
| Học xong quên ngay | Mọi mẫu câu đã nói tự động thành flashcard, ôn theo lịch |
| Không thấy tiến bộ | Điểm phát âm theo thời gian, streak, số câu đã nói |
| Ngại ghi âm giọng mình gửi lên mạng | Toàn bộ xử lý trên máy chủ của mình, nói rõ trong onboarding |

### Không phục vụ (ở giai đoạn này)

- Luyện thi IELTS/TOEIC — cần ngân hàng đề và cấu trúc chấm riêng.
- Ghép cặp người-với-người (WebRTC) — phức tạp về vận hành, để giai đoạn sau.
- Học ngữ pháp hàn lâm — chỉ dạy ngữ pháp ở mức đủ để nói đúng.

---

## 3. Vòng lặp cốt lõi

```
        ┌─────────────────────────────────────────────┐
        │                                             │
   Bài học ngắn ──▶ Nói với AI ──▶ Nhận feedback ──▶ Câu mới vào SRS
   (5 phút)         (5 phút)       (phát âm/ngữ pháp)      │
        ▲                                                  │
        └────────────── Ôn flashcard (5 phút) ◀────────────┘
```

**Một phiên học chuẩn = 15 phút**, gồm 3 chặng trên. Người dùng có thể vào thẳng bất kỳ chặng nào.

### Luồng một phiên hội thoại

1. Chọn tình huống (ví dụ *Gọi món ở quán cà phê*).
2. Màn hình hiện bối cảnh bằng tiếng Việt + 5 từ khóa sẽ dùng.
3. AI mở lời bằng giọng nói, có phụ đề tiếng Anh, nút dịch nghĩa, nút nghe chậm 0.7x.
4. Người học bấm giữ để nói (hoặc bấm 1 trong 3 gợi ý để đọc theo).
5. Hệ thống trả về trong ~1,5 giây: bản chép lời đã nói, điểm phát âm từng từ (tô màu), câu đã được sửa nếu sai.
6. AI đáp lại và dẫn tiếp hội thoại. Lặp 6–10 lượt.
7. Kết phiên: bảng tổng kết — điểm phát âm trung bình, 3 từ phát âm kém nhất, 5 mẫu câu được thêm vào bộ flashcard.

### Nguyên tắc thiết kế cho A0–A1

- AI chỉ dùng từ trong **danh sách 800 từ thông dụng nhất** + từ vựng của bài đang học.
- Câu AI nói tối đa **12 từ**, tốc độ 0.85x mặc định.
- Luôn có đường thoát: nút "Gợi ý", nút "Nói tiếng Việt, tôi dịch giúp", nút "Bỏ qua lượt này".
- Không bao giờ chỉ hiện điểm thấp — luôn kèm hành động cụ thể ("Âm /θ/ trong *think*: đặt lưỡi giữa hai hàm răng — nghe mẫu").

---

## 4. Kiến trúc hệ thống

Điểm khác biệt lớn nhất so với v1.0: xuất hiện thêm **một tầng dịch vụ AI viết bằng Python, chạy trên máy GPU riêng**, tách hẳn khỏi tầng nghiệp vụ Node.

```
                      ┌──────────────────────┐
   Trình duyệt  ◀────▶│  Next.js 15 (web)    │  SSR/RSC, Tailwind, shadcn/ui
   (Web Audio,        │                      │  Silero VAD chạy ngay trên
    MediaRecorder)    └──────────┬───────────┘  trình duyệt qua ONNX Runtime Web
                                 │ REST + WebSocket (JWT)
                      ┌──────────▼───────────┐
                      │  NestJS API          │  auth, lessons, conversation,
                      │  Prisma ORM          │  srs, progress, media
                      └───┬──────────┬───────┘
                          │          │
              ┌───────────▼──┐   ┌───▼──────────────┐
              │ PostgreSQL16 │   │ Redis + BullMQ   │
              └──────────────┘   └───┬──────────────┘
                                     │
        ═══════════════════════ máy GPU riêng ═══════════════════════
                                     │ gRPC / HTTP nội bộ
                      ┌──────────────▼────────────────┐
                      │  ai-gateway (FastAPI)         │  hàng đợi, batching,
                      │  Python 3.12                  │  hạn mức, đo lường
                      └───┬────────┬────────┬─────────┘
                          │        │        │
                  ┌───────▼──┐ ┌───▼────┐ ┌─▼─────────────┐
                  │  vLLM    │ │ faster │ │ pron-scorer   │
                  │ Qwen3-8B │ │whisper │ │ wav2vec2 +GOP │
                  │  AWQ     │ │ turbo  │ │ + GOPT head   │
                  └──────────┘ └────────┘ └───────────────┘
                          │
                  ┌───────▼──────┐
                  │  Kokoro TTS  │  sinh sẵn & cache vào S3
                  └──────────────┘
```

### Vì sao tách tầng AI ra riêng

- **Ngôn ngữ khác nhau.** Hệ sinh thái mô hình mở nằm ở Python; ép nó vào Node qua binding chỉ chuốc khổ.
- **Vòng đời khác nhau.** Đổi model không nên buộc phải deploy lại API nghiệp vụ.
- **Phần cứng khác nhau.** Tầng nghiệp vụ chạy CPU rẻ tiền và cần uptime cao; tầng AI cần GPU và có thể tạm ngừng để nâng cấp.
- **Chống sập.** `ai-gateway` có hàng đợi và hạn mức riêng, GPU quá tải thì xếp hàng chứ không kéo sập cả web.

### Monorepo

```
communication-learning/
├─ apps/
│  ├─ web/            # Next.js 15
│  ├─ api/            # NestJS
│  └─ worker/         # BullMQ consumers
├─ services/
│  └─ ai-gateway/     # FastAPI + vLLM + ASR + pron-scorer + TTS (Python)
├─ packages/
│  ├─ db/             # Prisma schema + migrations + seed
│  ├─ shared/         # types, zod schemas, hằng số dùng chung
│  └─ ui/             # component dùng chung
├─ content/           # nội dung bài học dạng YAML/JSON, versioned
├─ ml/                # notebook, script hiệu chỉnh & đánh giá mô hình chấm phát âm
├─ docker/            # Dockerfile, compose, nginx
└─ docs/
```

Dùng **pnpm workspaces + Turborepo** cho phần TypeScript, **uv** cho phần Python. `docker compose up` dựng đủ Postgres, Redis, MinIO, api, worker, web; `docker compose --profile gpu up` thêm tầng AI cho máy có GPU.

---

## 5. Chọn mô hình — bốn quyết định

### 5.1 Mô hình ngôn ngữ (hội thoại, sửa lỗi, sinh gợi ý)

| Mô hình | Giấy phép | Nhận xét | Quyết định |
|---|---|---|---|
| **Qwen3-8B (AWQ 4-bit)** | Apache 2.0 | Tiếng Việt tốt nhất trong nhóm nhỏ, ~6GB VRAM, ~60 tok/s trên 4090 | **Chọn cho MVP** |
| Qwen3-14B (AWQ) | Apache 2.0 | Khá hơn rõ rệt, ~10GB VRAM | Nâng cấp khi có GPU 24GB+ |
| Gemma 3 12B | Gemma Terms | Đa ngữ tốt, **không phải giấy phép OSI**, có ràng buộc sử dụng | Dự phòng |
| Llama 3.3 70B | Llama Community | Quá nặng để tự host ở quy mô này; phải ghi "Built with Llama" | Không |
| SeaLLM / Sailor2 | Kiểm tra từng bản | Chuyên Đông Nam Á, tiếng Việt tự nhiên hơn | Đánh giá đối chứng ở Sprint 3 |

**Điều then chốt: không bắt mô hình 8B làm việc của mô hình 200B.** Ở trình độ A0, hội thoại vốn đã hẹp — 30 tình huống có kịch bản, mỗi lượt chỉ vài nhánh hợp lý. Vì vậy dùng **máy trạng thái lai**:

- Mỗi `Scenario` là một đồ thị trạng thái viết tay (chào → hỏi món → chốt đơn → cảm ơn), có sẵn câu mẫu cho từng nhánh.
- LLM chỉ làm ba việc hẹp: **phân loại** câu người học vào một nhánh, **diễn đạt lại** câu mẫu của nhánh đó cho tự nhiên, và **sửa lỗi** câu người học.
- Đầu ra bị ép theo JSON schema bằng **XGrammar/Outlines** (constrained decoding) — mô hình nhỏ không có cơ hội đi lạc.

Cách này đổi "sự sáng tạo tự do" lấy "độ tin cậy", và với A0 thì đó là đổi đúng chiều: người học cần một cuộc hội thoại *đoán trước được*, không cần một người bạn tâm giao.

**Nội dung sinh sẵn thì dùng mô hình lớn.** Việc viết 30 kịch bản, 600 từ vựng, 80 mẫu câu là việc *offline*, làm một lần. Thuê GPU lớn theo giờ chạy Qwen3-235B hoặc DeepSeek để sinh nháp, tốn vài chục USD, rồi giáo viên rà soát. Đừng để chất lượng nội dung bị giới hạn bởi mô hình chạy realtime.

### 5.2 Nhận dạng giọng nói (STT)

| Mô hình | Giấy phép | Nhận xét |
|---|---|---|
| **Whisper large-v3-turbo qua faster-whisper** | MIT (model) + MIT (CTranslate2) | ~809M tham số, nhanh gấp nhiều lần large-v3, ~2GB VRAM ở int8. **Chọn** |
| Whisper large-v3 | MIT | Chính xác hơn chút, chậm hơn nhiều — không đáng ở đây |
| distil-whisper | MIT | Nhẹ hơn nữa, cân nhắc nếu VRAM căng |
| NVIDIA Parakeet / Canary | CC-BY-4.0 | Rất nhanh, tiếng Anh tốt — đối chứng ở Sprint 1 |

Ghi chú quan trọng: Whisper **rất giỏi đoán ý** — nó tự sửa phát âm sai thành từ đúng. Đó là lý do nó tốt cho việc chép lời hội thoại tự do và **hoàn toàn vô dụng cho việc chấm phát âm**.

### 5.3 Chấm phát âm — phần khó nhất, không có sẵn đồ dùng liền

Đây là chỗ mã nguồn mở đòi hỏi công sức thật, vì không có gói nào cắm vào là chạy. Nhưng con đường thì rõ ràng và đã có người đi:

**Bước 1 — lấy chuỗi âm vị chuẩn.** Từ văn bản đích, tra `CMUdict`; từ nào không có thì `g2p_en` hoặc `espeak-ng` sinh ra.

**Bước 2 — căn chỉnh và lấy xác suất từng khung.** Hai lựa chọn:
- `wav2vec2` fine-tune nhận diện âm vị (ví dụ `wav2vec2-xlsr-53-espeak-cv-ft`, Apache 2.0) → xác suất hậu nghiệm trên từng âm vị theo khung 20ms.
- **Montreal Forced Aligner** (MIT, nền Kaldi) khi cần ranh giới âm vị chính xác hơn.

**Bước 3 — tính GOP (Goodness of Pronunciation).** Với mỗi âm vị chuẩn:

```
GOP(p) = log P(p | đoạn âm thanh) − max  log P(q | đoạn âm thanh)
                                    q∈tất cả âm vị
```

Nói nôm na: *âm vị đáng lẽ phải nói* có sức thuyết phục kém hơn *âm vị nghe giống nhất* bao nhiêu. Chênh lệch càng lớn thì phát âm càng sai.

**Bước 4 — biến GOP thô thành điểm người dùng hiểu được.** GOP là số âm không có thang. Huấn luyện một đầu hồi quy nhỏ (kiến trúc **GOPT** — transformer đặt trên đặc trưng GOP, mã nguồn mở) để xuất ra bốn điểm giống chuẩn ngành: accuracy, fluency, completeness, prosody.

**Dữ liệu để huấn luyện và kiểm chứng:**

| Bộ dữ liệu | Nội dung | Vai trò | Lưu ý giấy phép |
|---|---|---|---|
| **speechocean762** | ~5.000 câu tiếng Anh của người học, có điểm chấm tay ở mức âm vị / từ / câu | Huấn luyện đầu hồi quy, so chuẩn | Bộ mở trên OpenSLR — **kiểm tra điều khoản trước khi dùng thương mại** |
| **L2-ARCTIC** | Người học tiếng Anh 6 tiếng mẹ đẻ, **trong đó có tiếng Việt**, chú thích lỗi ở mức âm vị | Kiểm chứng riêng cho giọng Việt | Thường chỉ cấp cho nghiên cứu — **phải xin phép, không mặc định dùng thương mại được** |
| Dữ liệu tự thu | 200–300 câu người Việt đọc mẫu, giáo viên chấm | Hiệu chỉnh thang điểm cho đúng đối tượng thật | Thu với sự đồng ý rõ ràng, đây là tài sản dài hạn của dự án |

**Đây là điểm khiến lộ trình dài thêm 4 tuần** so với v1.0. Đổi lại, sau khi làm xong thì khoản chi lớn nhất trong bảng chi phí cũ biến mất hoàn toàn, và ta có một mô hình *được hiệu chỉnh riêng cho người Việt* — thứ mà API thương mại không cho.

**Phương án lùi nếu Sprint 2 không đạt:** hạ độ chi tiết thay vì hạ chất lượng. Bỏ hiển thị điểm số tuyệt đối, chỉ còn ba mức màu ở **mức từ** (không phải mức âm vị), và chỉ hiện khi độ tin cậy vượt ngưỡng. Người học vẫn nhận được thứ họ cần — "từ này chưa ổn, nghe lại mẫu" — mà không phải hứa một độ chính xác chưa có.

### 5.4 Tổng hợp giọng nói (TTS)

| Mô hình | Giấy phép | Quyết định |
|---|---|---|
| **Kokoro-82M** | Apache 2.0 | Chất lượng trên kích thước rất tốt, cực nhanh, chỉnh được tốc độ. **Chọn** |
| **Piper** | MIT | Chạy CPU, dùng làm phương án dự phòng khi GPU bận |
| Orpheus TTS | Apache 2.0 | Tự nhiên hơn nhưng nặng hơn — cân nhắc cho giọng kể chuyện sau này |
| ⚠️ XTTS-v2 (Coqui) | **Coqui Public Model License — phi thương mại** | **Không dùng.** Bẫy giấy phép phổ biến nhất trong mảng TTS mở |
| ⚠️ F5-TTS | Mã nguồn mở nhưng **trọng số thường là CC-BY-NC** | Không dùng nếu chưa xác minh được điều khoản |

Chiến lược vẫn như cũ và giờ còn hiệu quả hơn: **sinh sẵn toàn bộ audio của nội dung tĩnh lúc seed, cache vào S3.** Chỉ những câu AI ứng biến mới gọi TTS lúc chạy — mà nhờ máy trạng thái ở mục 5.1, số câu đó ít hơn nhiều so với hội thoại tự do hoàn toàn.

### 5.5 Phát hiện giọng nói (VAD)

**Silero VAD** (MIT), chạy **ngay trên trình duyệt** qua ONNX Runtime Web. Nhờ vậy audio chỉ được gửi đi khi người học thật sự nói — tiết kiệm băng thông, giảm tải GPU, và tự động biết lúc nào người học nói xong để đóng lượt.

---

## 6. Ngân sách độ trễ

Tự host thực ra **nhanh hơn** gọi API, vì bỏ được round-trip mạng ra ngoài. Mục tiêu p95 từ lúc thả nút tới lúc AI bắt đầu phát tiếng:

| Chặng | Ngân sách | Ghi chú |
|---|---|---|
| Tải audio lên (5 giây nói) | 120 ms | Đã nén opus, VAD đã cắt phần im lặng |
| STT — Whisper turbo | 250 ms | Trên GPU, batch = 1 |
| Chấm phát âm (chạy song song với STT) | 150 ms | Không cộng vào tổng vì song song |
| LLM — token đầu tiên | 200 ms | Qwen3-8B AWQ, prompt đã cache prefix |
| LLM — sinh xong câu đầu | 300 ms | Stream theo câu, không chờ hết đoạn |
| TTS câu đầu — Kokoro | 150 ms | Cache hit thì còn ~20 ms |
| Truyền về + đệm phát | 100 ms | |
| **Tổng tới tiếng nói đầu tiên** | **≈ 1,1 giây** | Ngân sách p95 đặt ở **1,8 giây** |

Ba kỹ thuật giữ được con số này: **prefix caching** trong vLLM (phần system prompt và kịch bản giống nhau giữa các lượt), **stream theo câu** thay vì theo cả lượt, và **cache TTS** cho mọi câu đã từng sinh.

---

## 7. Kiểm toán giấy phép

Vì đây là dự án thương mại, giấy phép không phải chuyện hình thức. Nguyên tắc: **chỉ đưa vào sản phẩm những thứ chắc chắn cho phép dùng thương mại**; thứ chưa rõ thì chỉ dùng để đánh giá nội bộ và phải ghi lại rõ ràng.

| Thành phần | Giấy phép | Thương mại | Ghi chú |
|---|---|---|---|
| Qwen3-8B | Apache 2.0 | ✅ | Sạch nhất trong nhóm |
| Whisper large-v3-turbo | MIT | ✅ | |
| faster-whisper / CTranslate2 | MIT | ✅ | |
| wav2vec2 (bản XLSR espeak) | Apache 2.0 | ✅ | Kiểm tra lại từng checkpoint cụ thể |
| Montreal Forced Aligner | MIT | ✅ | |
| GOPT (mã nguồn) | Mã nguồn mở | ✅ | Xác minh giấy phép repo trước khi vendor hóa |
| Kokoro-82M | Apache 2.0 | ✅ | |
| Piper | MIT | ✅ | |
| Silero VAD | MIT | ✅ | |
| vLLM | Apache 2.0 | ✅ | |
| Gemma 3 | Gemma Terms | ⚠️ | Cho phép thương mại nhưng **không phải giấy phép mở theo chuẩn OSI**. Lưu ý: **Gemma 4 (03/2026) đã chuyển sang Apache 2.0** — xem `MODEL-RESEARCH.md` |
| Llama 3.x / 4 | Llama Community | ⚠️ | Được, nếu dưới 700 triệu MAU, và phải ghi công "Built with Llama" |
| XTTS-v2 | Coqui CPML | ❌ | Phi thương mại |
| speechocean762 | Bộ mở | ⚠️ | Xác minh điều khoản trước khi dùng huấn luyện mô hình thương mại |
| L2-ARCTIC | Cấp cho nghiên cứu | ⚠️ | Phải xin phép; mặc định coi là **chỉ để đánh giá nội bộ** |

**Việc bắt buộc ở Sprint 0:** lập file `docs/LICENSES.md` liệt kê mọi trọng số và bộ dữ liệu kèm đường dẫn tới giấy phép gốc, và thêm một bước CI chặn merge nếu có model mới xuất hiện mà chưa được ghi vào đó. Kiểm toán giấy phép sau khi đã lên sản phẩm thì đắt hơn nhiều lần.

---

## 8. Mô hình dữ liệu

Các bảng chính (Prisma):

```prisma
// ── Người dùng ────────────────────────────────
User            id, email, passwordHash, createdAt
Profile         userId, displayName, nativeLang, level, dailyGoalMin, timezone
Streak          userId, current, longest, lastActiveDate

// ── Nội dung ──────────────────────────────────
Course          slug, title, level          // "Giao tiếp cơ bản A0"
Unit            courseId, order, title      // "Ở quán ăn"
Lesson          unitId, order, title, type  // vocab | dialogue | drill
LessonItem      lessonId, order, kind, payload(jsonb)
Scenario        unitId, slug, titleVi, context, systemPrompt,
                allowedVocab(text[]), stateGraph(jsonb), successCriteria(jsonb)
Phrase          text, ipa, meaningVi, audioUrl, tags[]   // nguồn cho flashcard

// ── Hội thoại ─────────────────────────────────
ConversationSession  userId, scenarioId, startedAt, endedAt,
                     turnCount, avgPronScore, summary(jsonb)
ConversationTurn     sessionId, role, text, audioUrl, latencyMs,
                     correctedText, grammarNotes(jsonb), stateNode
PronunciationScore   turnId, modelVersion, accuracy, fluency, completeness,
                     prosody, confidence, wordScores(jsonb)

// ── SRS ───────────────────────────────────────
Card            userId, phraseId | turnId, front, back, audioUrl, source
CardState       cardId, due, stability, difficulty, reps, lapses, state
ReviewLog       cardId, rating, reviewedAt, elapsedDays, scheduledDays

// ── Tiến độ ───────────────────────────────────
LessonProgress  userId, lessonId, status, score, completedAt
DailyActivity   userId, date, minutes, turnsSpoken, cardsReviewed, xp
```

Ghi chú:
- `CardState` theo đúng cấu trúc **FSRS-5** — dùng thư viện `ts-fsrs`, không tự viết SM-2.
- `PronunciationScore.modelVersion` và `.confidence` là **bắt buộc**, không phải tùy chọn: khi mô hình chấm được huấn luyện lại, phải biết điểm cũ sinh ra từ phiên bản nào, nếu không thì mọi biểu đồ tiến bộ đều vô nghĩa.
- `Scenario.stateGraph` chứa đồ thị trạng thái hội thoại ở mục 5.1.
- Toàn bộ audio người dùng lưu trên S3, DB chỉ giữ key. Có job dọn audio cũ hơn 90 ngày — **trừ những mẫu người dùng đồng ý cho giữ lại để cải thiện mô hình**, đánh dấu bằng cờ riêng.
- Nội dung bài học nằm trong `content/*.yaml` được commit vào repo, seed vào DB qua script → giáo viên review nội dung bằng pull request.

---

## 9. Đặc tả tính năng MVP

### 9.1 Hội thoại AI có chấm phát âm

```
Người dùng bấm giữ → Silero VAD (trên trình duyệt) cắt đúng đoạn có tiếng
   → MediaRecorder (webm/opus, 16kHz mono)
   → POST /conversations/:id/turns  →  NestJS xếp việc vào ai-gateway
   → ai-gateway chạy song song:
        ├─ faster-whisper           → text người dùng nói
        └─ pron-scorer (wav2vec2+GOP) → điểm từng từ / từng âm vị
   → vLLM (Qwen3-8B) nhận [nút trạng thái hiện tại + text vừa nói + hồ sơ lỗi]
        → JSON có ràng buộc schema: {nextNode, reply, correction, hints[]}
   → Kokoro TTS (cache-first) → audioUrl
   → stream toàn bộ về client qua WebSocket
```

**Kiểm soát trình độ A0–A1:** ràng buộc trong prompt (thì hiện tại đơn/tiếp diễn, câu ≤ 12 từ, chỉ dùng `allowedVocab` + 800 từ phổ thông), **cộng thêm** kiểm tra sau khi sinh — đếm từ ngoài danh sách, vượt ngưỡng thì rơi về câu mẫu viết tay của nút trạng thái đó. Với mô hình nhỏ, câu mẫu viết tay là lưới an toàn chứ không phải giải pháp tạm.

**Hiển thị điểm phát âm:** mỗi từ tô màu theo thang xanh → vàng → đỏ; bấm vào từ sẽ hiện IPA, âm vị sai được khoanh, kèm nút nghe giọng mẫu và mẹo đặt lưỡi bằng tiếng Việt. Khi `confidence` dưới ngưỡng, hệ thống **không hiện điểm** — im lặng tốt hơn sai.

### 9.2 Flashcard SRS

- **Nguồn thẻ tự động:** cuối phiên, worker chọn 3–5 mẫu câu (câu người học nói sai, câu AI dùng có từ mới) và tạo thẻ. Người học duyệt "Thêm / Bỏ".
- **Loại thẻ:** nghe → chọn nghĩa; nghĩa Việt → nói ra câu tiếng Anh (chấm bằng STT + pron-scorer); điền từ vào chỗ trống.
- **Thuật toán:** FSRS-5, bốn mức Again / Hard / Good / Easy. Mặc định 20 thẻ mới + 100 thẻ ôn mỗi ngày.

### 9.3 Nội dung nền tảng

Vẫn là hạng mục tốn công nhất, và mã nguồn mở không làm nó dễ đi. Cần cho MVP:

- **6 unit × 5 tình huống = 30 tình huống**, mỗi tình huống kèm **đồ thị trạng thái và câu mẫu cho từng nhánh** (yêu cầu mới của kiến trúc lai — công viết nội dung tăng khoảng 30% so với v1.0).
- **600 từ vựng lõi** kèm IPA, nghĩa tiếng Việt, câu ví dụ, audio.
- **80 mẫu câu khung** ("Can I have ___, please?").
- **Bộ mẹo phát âm cho 12 âm khó với người Việt**: /θ/ /ð/, cặp /s/–/ʃ/, các âm cuối /t/ /d/ /s/ /z/ hay bị nuốt, cặp /l/–/n/, /r/, các cặp nguyên âm dài–ngắn.

Quy trình: sinh nháp bằng mô hình lớn thuê theo giờ → **giáo viên rà soát** → duyệt qua pull request → seed → sinh TTS và cache. Không đưa nội dung do AI sinh thẳng ra sản phẩm.

---

## 10. Lộ trình triển khai

**16 tuần, 8 sprint × 2 tuần** — dài hơn v1.0 bốn tuần, toàn bộ phần chênh nằm ở R&D chấm phát âm.

| Sprint | Thời gian | Mục tiêu | Kết quả bàn giao |
|---|---|---|---|
| **0. Nền móng** | Tuần 1–2 | Dựng khung + máy GPU | Monorepo, Docker Compose, Prisma schema, auth, CI, deploy staging, **máy GPU chạy được vLLM + Whisper + Kokoro**, `docs/LICENSES.md` |
| **1. Đường ống giọng nói** | Tuần 3–4 | Nghe và nói được | VAD trên trình duyệt → STT → TTS, đo độ trễ thật đầu-cuối trên phần cứng thật |
| **2. Chấm phát âm** ⚠️ | Tuần 5–6 | Phần khó nhất | GOP + đầu hồi quy, so chuẩn trên speechocean762, kiểm chứng trên giọng Việt |
| **3. Hội thoại AI** | Tuần 7–8 | Vòng lặp cốt lõi | Máy trạng thái + Qwen3 có ràng buộc schema, 5 tình huống chạy đầu-cuối |
| **4. SRS + nội dung** | Tuần 9–10 | Giữ chân người học | FSRS, 3 loại thẻ, tự sinh thẻ, seed đủ 30 tình huống + 600 từ |
| **5. Tiến độ & động lực** | Tuần 11–12 | Tạo thói quen | Mục tiêu ngày, streak, biểu đồ điểm phát âm, thông báo, onboarding + test xếp lớp |
| **6. Vận hành GPU** | Tuần 13–14 | Chịu được tải thật | Batching, hàng đợi, tự khởi động lại, giám sát GPU, kiểm thử tải, kế hoạch dự phòng khi GPU chết |
| **7. Hoàn thiện & mở** | Tuần 15–16 | Sẵn sàng công bố | PWA + tối ưu mobile, dọn hiệu năng, chặn lạm dụng, beta kín 50 người |

### Cột mốc kiểm chứng

- **Cuối Sprint 1** — nếu p95 độ trễ trên phần cứng thật vượt 2,5 giây, dừng lại tối ưu trước khi xây tiếp. Số đo trên GPU thuê theo giờ không tính; phải là máy sẽ dùng thật.
- **Cuối Sprint 2 (cổng gắt nhất)** — điểm mô hình chấm phải **tương quan Pearson ≥ 0,6 với điểm giáo viên** trên tập kiểm chứng giọng Việt tự thu. Không đạt thì chuyển sang phương án lùi ở mục 5.3 chứ không kéo dài R&D vô hạn.
- **Cuối Sprint 4** — 10 người dùng thật hoàn thành trọn một phiên 15 phút mà không cần trợ giúp.
- **Cuối Sprint 6** — chịu được 50 phiên đồng thời trên một GPU mà p95 không vượt 3 giây.
- **Cuối Sprint 7** — 50 beta users, đo tỷ lệ quay lại ngày thứ 7.

---

## 11. Chi phí vận hành ước tính

Giả định 1.000 người dùng hoạt động hàng tháng, mỗi người 15 phút/ngày, 20 ngày/tháng.

| Khoản | USD/tháng | Ghi chú |
|---|---|---|
| Máy GPU (RTX 4000 Ada 20GB hoặc 4090 24GB, thuê nguyên máy) | 200–320 | Khoản lớn nhất, và là khoản **cố định** |
| VPS ứng dụng (8 vCPU, 16GB) | 40–60 | Web, API, worker, Postgres |
| Object storage + băng thông | 10–20 | Cloudflare R2, không phí egress |
| LLM / STT / TTS / chấm phát âm | **0** | Chạy trên chính GPU đã trả tiền |
| Sinh nội dung bằng mô hình lớn (thuê theo giờ) | ~15 | Không đều — chỉ khi làm nội dung mới |
| Giám sát, email, tên miền | 20 | |
| **Tổng** | **285–435** | Khoảng **0,29–0,44 USD/người dùng/tháng** |

### So với phương án dùng API

| Quy mô | Tự host (mã nguồn mở) | Dùng API thương mại |
|---|---|---|
| 100 người dùng | ~300 USD | ~120 USD |
| 1.000 người dùng | ~350 USD | ~600 USD |
| 5.000 người dùng | ~450 USD (thêm 1 GPU) | ~2.600 USD |
| 20.000 người dùng | ~1.100 USD (3–4 GPU) | ~10.000 USD |

Đường chi phí tự host gần như nằm ngang, đường API dốc tuyến tính. Nhưng **ở dưới khoảng 700 người dùng thì tự host đắt hơn** — cần nhìn thẳng vào điều đó khi quyết định.

**Chi phí ẩn không có trong bảng:** khoảng 4–6 tuần công kỹ thuật cho phần chấm phát âm, cộng công vận hành GPU đều đặn về sau. Quy ra tiền lương thì đây mới là khoản lớn nhất trong năm đầu.

---

## 12. Rủi ro

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Mô hình chấm phát âm tự làm không đạt độ chính xác cần thiết | **Cao** | Cổng kiểm chứng cứng ở cuối Sprint 2 với ngưỡng tương quan ≥ 0,6; có sẵn phương án lùi về chấm mức từ ở mục 5.3 |
| GPU chết là cả sản phẩm chết | **Cao** | Chế độ suy giảm: khi tầng AI không phản hồi, web vẫn cho học flashcard và nghe audio đã cache. Kèm cảnh báo và kịch bản dựng lại trong 30 phút |
| Qwen3-8B đuối, hội thoại nghe máy móc | Trung bình | Máy trạng thái + câu mẫu viết tay đã hạ phụ thuộc vào LLM; nâng lên 14B khi có GPU lớn hơn |
| Bẫy giấy phép — dùng nhầm trọng số phi thương mại | Trung bình | `docs/LICENSES.md` + chặn ở CI, làm ngay Sprint 0 |
| Độ trễ trên phần cứng thật cao hơn tính toán | Trung bình | Đo trên máy thật ở Sprint 1, không tin số đo trên GPU thuê |
| Nhóm không có người biết ML | **Cao nếu đúng** | Đây là điều kiện tiên quyết của cả hướng đi này. Nếu không có, hãy dùng API cho MVP rồi chuyển dần sang tự host sau |
| Nội dung là nút thắt tiến độ | Trung bình | Bắt đầu viết từ Sprint 0; lưu ý đồ thị trạng thái làm tăng ~30% công viết |
| Người dùng bỏ sau 3 ngày | Cao (đặc thù ngành) | Phiên ngắn, thắng nhỏ liên tục, nhắc đúng giờ, tiến bộ thấy được bằng số |
| Quyền riêng tư giọng nói | Thấp hơn v1.0 | Tự host là lợi thế — nói rõ "giọng nói của bạn không rời máy chủ chúng tôi"; vẫn cho tải về/xóa, tự xóa sau 90 ngày |

---

## 13. Chỉ số theo dõi

**Sức khỏe sản phẩm**
- Tỷ lệ quay lại ngày 1 / 7 / 30 (mục tiêu D7 ≥ 25%)
- Số lượt nói mỗi người mỗi tuần (mục tiêu ≥ 40)
- Tỷ lệ hoàn thành phiên hội thoại (mục tiêu ≥ 70%)

**Học tập**
- Điểm phát âm trung bình theo tuần (so sánh **trong cùng `modelVersion`**)
- Độ chính xác lần đầu khi ôn thẻ (mục tiêu 80–85%)
- Số câu nói được không cần gợi ý — chỉ số quan trọng nhất về sự tự tin

**Kỹ thuật — mục mới, đặc thù của tự host**
- p95 độ trễ từng chặng (STT / chấm điểm / LLM / TTS) chứ không chỉ tổng
- Mức sử dụng GPU, độ sâu hàng đợi, số lần OOM
- Tỷ lệ cache hit của TTS
- Tương quan giữa điểm mô hình và điểm giáo viên, đo lại hằng tháng trên tập giữ riêng

---

## 14. Sau MVP

1. **Fine-tune Whisper cho giọng Việt** bằng chính dữ liệu thu được — lợi thế tự host lớn nhất, và không API nào cho.
2. **App mobile** (React Native, dùng lại API).
3. **Chưng cất mô hình chấm phát âm** xuống bản nhỏ chạy được trên CPU, để giảm phụ thuộc GPU.
4. **Ghép cặp luyện nói người-với-người** qua WebRTC.
5. **Lộ trình theo ngành nghề** — nhà hàng, IT, chăm sóc khách hàng.
6. **Bảng theo dõi cho giáo viên/trung tâm** — nguồn doanh thu B2B.

---

## 15. Việc cần làm ngay để bắt đầu Sprint 0

1. **Chốt máy GPU** và dựng thử vLLM + Qwen3-8B-AWQ + faster-whisper + Kokoro trên đó. Đo tốc độ thật trước khi lên kế hoạch dựa vào nó.
2. **Chạy thử GOP trên 5 file ghi âm giọng Việt** bằng wav2vec2 + CMUdict, xem điểm thô có phân biệt được câu đọc chuẩn với câu đọc sai cố ý không. Đây là thí nghiệm rẻ nhất để biết cả hướng đi có sống được không.
3. Lập `docs/LICENSES.md` và thêm bước CI chặn model chưa được kiểm toán giấy phép.
4. Khởi tạo monorepo (pnpm + Turborepo cho TS, uv cho Python), `docker-compose.yml` với profile `gpu` riêng.
5. Viết Prisma schema theo mục 8, chạy migration đầu tiên.
6. Dựng auth (NextAuth + JWT sang NestJS) và khung layout tiếng Việt.
7. Viết unit đầu tiên (5 tình huống chào hỏi) **kèm đồ thị trạng thái** dạng YAML.
8. Thiết lập CI: lint, typecheck, test, build Docker image, deploy staging.

Việc số 1 và số 2 nên làm **trước tiên và song song với nhau**. Cả hai đều chỉ mất vài ngày, và cả hai đều có thể cho ra kết luận "hướng này không khả thi với nguồn lực hiện có" — biết sớm thì rẻ.
