# Kế hoạch xây dựng web học giao tiếp tiếng Anh

> Tài liệu định hướng sản phẩm & kỹ thuật cho dự án **CommunicationLearning**.
> Phiên bản 1.0 — lập ngày 2026-08-27.

---

## 1. Tóm tắt

Xây dựng một web app giúp **người Việt mới bắt đầu (A0–A1)** dám mở miệng nói tiếng Anh, thông qua hai vòng lặp học tập bổ trợ nhau:

1. **Nói với AI** — hội thoại theo tình huống với giọng nói, được chấm phát âm tới từng từ/âm vị và sửa lỗi ngay.
2. **Flashcard SRS** — ghi nhớ mẫu câu & từ vựng vừa nói bằng thuật toán lặp lại ngắt quãng (FSRS).

Điểm khác biệt: mọi thứ được thiết kế cho **người sợ nói**. Câu ngắn, có gợi ý sẵn, có thể bấm nghe chậm, không bao giờ bị "bí" giữa cuộc hội thoại.

### Quyết định nền tảng

| Hạng mục | Lựa chọn |
|---|---|
| Đối tượng | Người mới bắt đầu A0–A1, giao diện tiếng Việt |
| MVP | Hội thoại AI có chấm phát âm + Flashcard SRS |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | NestJS (Node 22) + Prisma + PostgreSQL 16 + Redis/BullMQ |
| Hạ tầng | Docker Compose trên VPS tự quản, object storage S3-compatible |
| AI | Claude (Anthropic API) cho hội thoại; STT + TTS + chấm phát âm qua provider chuyên dụng |

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
5. Hệ thống trả về trong ~2 giây: bản chép lời đã nói, điểm phát âm từng từ (tô màu), câu đã được sửa nếu sai.
6. AI đáp lại và dẫn tiếp hội thoại. Lặp 6–10 lượt.
7. Kết phiên: bảng tổng kết — điểm phát âm trung bình, 3 từ phát âm kém nhất, 5 mẫu câu được thêm vào bộ flashcard.

### Nguyên tắc thiết kế cho A0–A1

- AI chỉ dùng từ trong **danh sách 800 từ thông dụng nhất** + từ vựng của bài đang học.
- Câu AI nói tối đa **12 từ**, tốc độ 0.85x mặc định.
- Luôn có đường thoát: nút "Gợi ý", nút "Nói tiếng Việt, tôi dịch giúp", nút "Bỏ qua lượt này".
- Không bao giờ chỉ hiện điểm thấp — luôn kèm hành động cụ thể ("Âm /θ/ trong *think*: đặt lưỡi giữa hai hàm răng — nghe mẫu").

---

## 4. Kiến trúc hệ thống

```
                      ┌──────────────────────┐
   Trình duyệt  ◀────▶│  Next.js 15 (web)    │  SSR/RSC, Tailwind, shadcn/ui
   (Web Audio,        │  Vercel-style build  │  chạy trong Docker
    MediaRecorder)    └──────────┬───────────┘
                                 │ REST + WebSocket (JWT)
                      ┌──────────▼───────────┐
                      │  NestJS API          │  auth, lessons, conversation,
                      │  Prisma ORM          │  srs, progress, media
                      └───┬──────────┬───────┘
                          │          │ enqueue
              ┌───────────▼──┐   ┌───▼──────────────┐
              │ PostgreSQL16 │   │ Redis + BullMQ   │
              └──────────────┘   └───┬──────────────┘
                                     │
                      ┌──────────────▼────────────────┐
                      │  Worker (Node)                │
                      │  - chấm phát âm                │
                      │  - sinh TTS & cache            │
                      │  - tổng kết phiên học          │
                      └───┬───────────┬────────┬──────┘
                          │           │        │
                    ┌─────▼────┐ ┌────▼────┐ ┌─▼──────────┐
                    │ Anthropic│ │ Speech  │ │ S3 storage │
                    │ Claude   │ │ STT/TTS │ │ (audio)    │
                    └──────────┘ └─────────┘ └────────────┘
```

### Monorepo

```
communication-learning/
├─ apps/
│  ├─ web/            # Next.js 15
│  ├─ api/            # NestJS
│  └─ worker/         # BullMQ consumers
├─ packages/
│  ├─ db/             # Prisma schema + migrations + seed
│  ├─ shared/         # types, zod schemas, hằng số dùng chung
│  └─ ui/             # component dùng chung
├─ content/           # nội dung bài học dạng YAML/JSON, versioned
├─ docker/            # Dockerfile, compose, nginx
└─ docs/
```

Dùng **pnpm workspaces + Turborepo**. Một `docker compose up` là chạy được toàn bộ stack ở máy local (Postgres, Redis, MinIO, api, worker, web).

### Lựa chọn dịch vụ giọng nói

Đây là quyết định kỹ thuật quan trọng nhất, vì **chấm phát âm** khó hơn nhận dạng giọng nói thông thường: cần căn chỉnh âm thanh với văn bản mục tiêu (forced alignment) rồi tính điểm từng âm vị.

| Phương án | Ưu | Nhược | Khuyến nghị |
|---|---|---|---|
| **Azure Speech — Pronunciation Assessment** | Cho sẵn điểm accuracy / fluency / completeness / prosody tới từng âm vị; hỗ trợ tốt giọng người Việt học tiếng Anh | Phụ thuộc nhà cung cấp, tính theo giờ audio | **Dùng cho MVP** |
| Self-host wav2vec2 + GOP (Goodness of Pronunciation) | Chi phí biên gần 0, toàn quyền kiểm soát | Cần GPU, phải tự hiệu chỉnh thang điểm, mất 4–6 tuần R&D | Giai đoạn 2, khi đã có dữ liệu để so chuẩn |
| Whisper (faster-whisper self-host) | Chép lời rất tốt, rẻ | **Không** chấm được phát âm — Whisper tự "sửa" lỗi phát âm thành từ đúng | Dùng kèm cho hội thoại tự do |

**Kết luận:** MVP dùng Azure cho phần chấm phát âm (bài đọc theo mẫu, biết trước văn bản đích), Whisper self-host cho phần hội thoại tự do (không biết trước người dùng nói gì). Tầng dịch vụ được viết sau một interface `SpeechProvider` để đổi nhà cung cấp mà không sửa nghiệp vụ.

TTS: Azure Neural TTS cho MVP (giọng tự nhiên, điều chỉnh được tốc độ qua SSML). Toàn bộ câu thoại cố định được **sinh sẵn và cache vào S3** khi seed nội dung → chi phí TTS lúc chạy gần bằng 0, độ trễ chỉ còn thời gian tải file.

---

## 5. Mô hình dữ liệu

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
                allowedVocab(text[]), successCriteria(jsonb)
Phrase          text, ipa, meaningVi, audioUrl, tags[]   // nguồn cho flashcard

// ── Hội thoại ─────────────────────────────────
ConversationSession  userId, scenarioId, startedAt, endedAt,
                     turnCount, avgPronScore, summary(jsonb)
ConversationTurn     sessionId, role, text, audioUrl, latencyMs,
                     correctedText, grammarNotes(jsonb)
PronunciationScore   turnId, accuracy, fluency, completeness, prosody,
                     wordScores(jsonb)   // [{word, score, phonemes:[...]}]

// ── SRS ───────────────────────────────────────
Card            userId, phraseId | turnId, front, back, audioUrl, source
CardState       cardId, due, stability, difficulty, reps, lapses, state
ReviewLog       cardId, rating, reviewedAt, elapsedDays, scheduledDays

// ── Tiến độ ───────────────────────────────────
LessonProgress  userId, lessonId, status, score, completedAt
DailyActivity   userId, date, minutes, turnsSpoken, cardsReviewed, xp
```

Ghi chú:
- `CardState` theo đúng cấu trúc **FSRS-5** (`stability`, `difficulty`, `state`) — dùng thư viện `ts-fsrs`, không tự viết SM-2.
- Toàn bộ audio người dùng lưu trên S3, DB chỉ giữ key. Có job dọn audio cũ hơn 90 ngày.
- Nội dung bài học nằm trong `content/*.yaml` được commit vào repo, seed vào DB qua script → dễ review nội dung bằng pull request.

---

## 6. Đặc tả tính năng MVP

### 6.1 Hội thoại AI có chấm phát âm

**Kiến trúc luồng nói (turn-based, không cần realtime streaming):**

```
Người dùng bấm giữ → MediaRecorder (webm/opus, 16kHz mono)
   → POST /conversations/:id/turns (multipart)
   → API lưu S3, gọi song song:
        ├─ STT (Whisper) → text người dùng nói
        └─ Pronunciation Assessment (nếu là bài đọc theo mẫu)
   → Claude nhận [lịch sử hội thoại + text vừa nói + hồ sơ lỗi của người học]
   → trả về: câu đáp + câu sửa lỗi + 3 gợi ý cho lượt sau
   → TTS (cache-first) → audioUrl
   → trả toàn bộ về client qua WebSocket
```

Mục tiêu độ trễ: **p95 < 2.5 giây** từ lúc thả nút tới lúc AI bắt đầu nói. Đạt được bằng: gọi STT và chấm phát âm song song, stream token từ Claude, TTS theo từng câu thay vì chờ cả đoạn.

**Kiểm soát AI cho trình độ A0–A1** (system prompt + kiểm tra sau):

- Ràng buộc trong prompt: chỉ dùng thì hiện tại đơn/tiếp diễn, câu ≤ 12 từ, chỉ dùng từ trong `allowedVocab` + 800 từ phổ thông.
- Kiểm tra sau khi sinh: đếm từ ngoài danh sách; nếu vượt ngưỡng thì yêu cầu Claude viết lại đơn giản hơn.
- AI không bao giờ sửa lỗi giữa dòng hội thoại — lỗi được gom lại và hiện ở panel bên cạnh, để không làm gãy mạch nói.
- Có "thang đỡ": sau 8 giây im lặng, tự hiện gợi ý; sau 15 giây, đọc mẫu luôn.

**Hiển thị điểm phát âm:** mỗi từ tô màu theo thang xanh → vàng → đỏ; bấm vào từ sẽ hiện IPA, âm vị sai được khoanh, kèm nút nghe giọng mẫu và mẹo đặt lưỡi bằng tiếng Việt.

### 6.2 Flashcard SRS

- **Nguồn thẻ tự động:** mỗi phiên hội thoại kết thúc, worker chọn 3–5 mẫu câu (câu người học nói sai, câu AI dùng có từ mới) và tạo thẻ. Người học duyệt "Thêm / Bỏ" — không tự nhồi thẻ vào bộ.
- **Loại thẻ:** nghe → chọn nghĩa; nghĩa Việt → nói ra câu tiếng Anh (chấm bằng STT); điền từ vào chỗ trống.
- **Thuật toán:** FSRS-5 với 4 mức đánh giá (Again / Hard / Good / Easy). Giới hạn mặc định 20 thẻ mới + 100 thẻ ôn mỗi ngày.
- **Thẻ nói được chấm bằng phát âm**, và điểm đó lại phản hồi ngược vào việc chọn nội dung hội thoại tiếp theo.

### 6.3 Nội dung nền tảng (thường bị đánh giá thấp)

Đây là hạng mục tốn công nhất và không thể thuê AI làm hết. Cần cho MVP:

- **6 unit × 5 tình huống = 30 tình huống hội thoại**, phủ: chào hỏi, giới thiệu bản thân, quán ăn, chỉ đường, mua sắm, công việc.
- **600 từ vựng lõi** kèm IPA, nghĩa tiếng Việt, câu ví dụ, audio.
- **80 mẫu câu khung** ("Can I have ___, please?").
- **Bộ mẹo phát âm cho 12 âm khó với người Việt**: /θ/ /ð/ /s/-/ʃ/, âm cuối /t/ /d/ /s/ /z/, /l/-/n/, /r/, nguyên âm dài–ngắn.

Quy trình: viết nháp bằng Claude → **giáo viên bản ngữ hoặc giáo viên tiếng Anh người Việt rà soát** → duyệt qua pull request → seed. Không đưa nội dung do AI sinh thẳng ra sản phẩm.

---

## 7. Lộ trình triển khai

12 tuần, 6 sprint × 2 tuần. Mỗi sprint kết thúc bằng một bản deploy chạy được.

| Sprint | Thời gian | Mục tiêu | Kết quả bàn giao |
|---|---|---|---|
| **0. Nền móng** | Tuần 1–2 | Dựng khung | Monorepo, Docker Compose, Prisma schema, auth (email + Google), CI (lint/test/build), deploy staging tự động |
| **1. Đường ống giọng nói** | Tuần 3–4 | Chứng minh phần khó nhất | Ghi âm trên trình duyệt → STT → chấm phát âm → hiện điểm từng từ. Một trang demo duy nhất, đo được độ trễ thật |
| **2. Hội thoại AI** | Tuần 5–6 | Vòng lặp cốt lõi | 5 tình huống chạy được đầu-cuối, gợi ý câu trả lời, tổng kết phiên, ràng buộc từ vựng A0 |
| **3. SRS + nội dung** | Tuần 7–8 | Giữ chân người học | FSRS, 3 loại thẻ, tự sinh thẻ từ hội thoại, seed đủ 30 tình huống + 600 từ |
| **4. Tiến độ & động lực** | Tuần 9–10 | Tạo thói quen | Trang chủ theo mục tiêu ngày, streak, biểu đồ điểm phát âm, thông báo đẩy, onboarding + test xếp lớp |
| **5. Hoàn thiện & mở** | Tuần 11–12 | Sẵn sàng công bố | PWA + tối ưu mobile, dọn hiệu năng, giám sát/cảnh báo, chặn lạm dụng chi phí, beta kín 50 người |

### Cột mốc kiểm chứng

- **Cuối Sprint 1** — nếu p95 độ trễ > 4s hoặc điểm phát âm không tương quan với đánh giá của giáo viên trên 20 mẫu thử, **dừng lại và đổi phương án nhà cung cấp** trước khi xây tiếp.
- **Cuối Sprint 3** — 10 người dùng thật hoàn thành trọn một phiên 15 phút mà không cần trợ giúp.
- **Cuối Sprint 5** — 50 beta users, đo tỷ lệ quay lại ngày thứ 7.

---

## 8. Chi phí vận hành ước tính

Giả định 1.000 người dùng hoạt động hàng tháng, mỗi người 15 phút/ngày, 20 ngày/tháng.

| Khoản | Ước tính/tháng | Ghi chú |
|---|---|---|
| VPS (8 vCPU, 16GB) | 40–60 USD | Chạy toàn bộ stack + Postgres |
| Object storage + băng thông | 10–20 USD | Cloudflare R2 (không tính phí egress) |
| Claude API | 150–250 USD | ~120k lượt hội thoại; dùng model nhỏ cho tác vụ phụ, cache prompt hệ thống |
| STT (Whisper self-host) | ~0 | Chạy trên chính VPS, CPU |
| Chấm phát âm (Azure) | 200–350 USD | Khoản đắt nhất — chỉ chấm bài đọc theo mẫu, không chấm mọi lượt |
| TTS | 20–40 USD | Nhờ cache sẵn nên rất thấp |
| Giám sát, email, tên miền | 20 USD | |
| **Tổng** | **~450–750 USD** | Khoảng 0,45–0,75 USD/người dùng/tháng |

**Ba đòn bẩy chính để giảm chi phí:** (1) cache toàn bộ TTS của nội dung tĩnh; (2) chỉ chấm phát âm ở lượt đọc theo mẫu, không phải mọi lượt nói tự do; (3) đặt hạn mức theo người dùng (ví dụ 30 lượt AI/ngày cho gói miễn phí) — chống cả lạm dụng lẫn cháy ví.

---

## 9. Rủi ro

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Chấm phát âm không chính xác với giọng Việt | **Cao** | Kiểm chứng ngay ở Sprint 1 trên 20 mẫu ghi âm thật, đối chiếu với giáo viên. Ẩn điểm số tuyệt đối, chỉ hiện 3 mức nếu độ tin cậy thấp |
| Độ trễ làm hỏng cảm giác hội thoại | Cao | Gọi song song + stream + cache TTS. Có phương án dự phòng: chế độ "văn bản trước, giọng sau" |
| Chi phí AI vượt kiểm soát | Trung bình | Hạn mức theo người dùng, cảnh báo ngân sách, prompt caching, model rẻ cho tác vụ phụ |
| AI nói quá khó so với trình độ A0 | Trung bình | Ràng buộc từ vựng + kiểm tra sau khi sinh + viết lại tự động |
| Nội dung là nút thắt tiến độ | Trung bình | Bắt đầu viết nội dung ngay từ Sprint 0, song song với code |
| Người dùng bỏ sau 3 ngày | Cao (đặc thù ngành) | Phiên học ngắn, thắng nhỏ liên tục, nhắc nhở đúng giờ, thấy rõ tiến bộ bằng số liệu |
| Quyền riêng tư giọng nói | Trung bình | Nói rõ trong onboarding, cho phép tải về/xóa dữ liệu, tự xóa audio sau 90 ngày |

---

## 10. Chỉ số theo dõi

**Chỉ số sức khỏe sản phẩm**
- Tỷ lệ quay lại ngày 1 / ngày 7 / ngày 30 (mục tiêu D7 ≥ 25%)
- Số lượt nói mỗi người mỗi tuần (mục tiêu ≥ 40)
- Tỷ lệ hoàn thành phiên hội thoại (mục tiêu ≥ 70%)

**Chỉ số học tập**
- Điểm phát âm trung bình theo tuần của mỗi người (kỳ vọng tăng)
- Độ chính xác lần đầu khi ôn thẻ SRS (mục tiêu 80–85% — quá cao nghĩa là bài quá dễ)
- Số câu nói được không cần gợi ý (chỉ số quan trọng nhất về sự tự tin)

**Chỉ số kỹ thuật**
- p95 độ trễ vòng nói
- Chi phí AI trên mỗi người dùng hoạt động
- Tỷ lệ lỗi của các dịch vụ giọng nói

---

## 11. Sau MVP

Theo thứ tự ưu tiên, phụ thuộc vào dữ liệu thực tế:

1. **App mobile** (React Native, dùng lại API) — người học tiếng Anh chủ yếu ở trên điện thoại.
2. **Ghép cặp luyện nói người-với-người** qua WebRTC, có chủ đề dẫn dắt sẵn.
3. **Lộ trình theo ngành nghề** — tiếng Anh cho nhà hàng, cho IT, cho chăm sóc khách hàng.
4. **Tự host mô hình chấm phát âm** để cắt khoản chi lớn nhất.
5. **Bảng theo dõi cho giáo viên/trung tâm** — nguồn doanh thu B2B.

---

## 12. Việc cần làm ngay để bắt đầu Sprint 0

1. Khởi tạo monorepo pnpm + Turborepo, dựng `docker-compose.yml` cho Postgres/Redis/MinIO.
2. Viết Prisma schema theo mục 5, chạy migration đầu tiên.
3. Đăng ký tài khoản Azure Speech, chạy thử Pronunciation Assessment trên 5 file ghi âm giọng Việt — **làm trước cả khi viết dòng code sản phẩm nào**.
4. Dựng auth (NextAuth + JWT sang NestJS) và khung layout tiếng Việt.
5. Viết nội dung unit đầu tiên (5 tình huống chào hỏi) dạng YAML để có dữ liệu thật mà phát triển.
6. Thiết lập CI: lint, typecheck, test, build Docker image, deploy staging.
