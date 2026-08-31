# Chạy trên Windows — cuối tuần 1 và 2

> Mục tiêu: **nói một câu và thấy nó thành chữ** (CT1), rồi **đọc sai một từ và thấy đúng từ đó đỏ lên** (CT2).
> Cấu hình đích: Ryzen 5 5600 · GTX 1060 6GB · 32GB RAM · Windows.
> Giá trị cấu hình đã chốt ở [`SPEC.md`](./SPEC.md).

Ba process, ba nơi: **Ollama native Windows** (chưa cần ở cuối tuần 1),
**speech-service trong Docker**, **Next.js native Windows**.

---

## 0. Chuẩn bị một lần

| Cần cài | Ghi chú |
|---|---|
| Driver NVIDIA ≥ 550 | Nhánh **CUDA 12.x**. Đừng nâng lên nhánh chỉ hỗ trợ CUDA 13 — đã bỏ Pascal |
| Docker Desktop | Bật **WSL2 backend** trong Settings → General |
| Node 22 + pnpm | `winget install OpenJS.NodeJS.LTS` rồi `corepack enable` |
| Git | Repo có `.gitattributes` ép LF cho `*.sh`, cứ clone bình thường |

**Giới hạn RAM cho WSL2.** Tạo `C:\Users\<tên>\.wslconfig`:

```ini
[wsl2]
memory=10GB
processors=6
swap=2GB
```

Rồi chạy `wsl --shutdown` trong PowerShell để áp dụng.

**Tắt tăng tốc phần cứng ở trình duyệt** dùng để mở app (Chrome/Edge: Settings → System →
tắt *Use graphics acceleration when available*). Trả lại ~0,5GB VRAM — xem `SPEC.md` mục 9.1.

**Kiểm tra GPU vào được container:**

```powershell
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

Thấy GTX 1060 là xong. Không thấy thì xem `SPEC.md` mục 9.5 trước khi đi tiếp.

---

## 1. Dựng speech-service

```powershell
pnpm install
pnpm speech:up          # lần đầu build image, mất 5-10 phút
pnpm speech:logs        # xem tới khi thấy "Application startup complete"
```

Tải trọng số Kokoro — một lần, khoảng 340MB, vào volume Docker chứ không phải ổ Windows:

```powershell
docker compose -f docker/compose.yml exec speech bash scripts/fetch-kokoro.sh
docker compose -f docker/compose.yml restart speech
```

Kiểm tra:

```powershell
curl http://127.0.0.1:8000/health
```

Mong đợi `"tts_ready": true`. Whisper nạp lười ở lần chép lời đầu tiên nên
`"whisper"` lúc này còn ghi *chưa nạp* — đúng, không phải lỗi.

### 1b. Xuất mô hình chấm phát âm — một lần

Cuối tuần 2 cần thêm wav2vec2 nhận âm vị. Trọng số phát hành ở dạng PyTorch, nhưng ảnh
runtime cố ý không có PyTorch (xem `PLAN-LOCAL.md` mục 3.3), nên việc xuất ONNX chạy trong
một container riêng dùng một lần rồi thôi:

```powershell
docker compose -f docker/compose.yml --profile tools run --rm tools
docker compose -f docker/compose.yml restart speech
```

Container `tools` tải PyTorch (~2,5GB, chỉ lần đầu), tải model, xuất ONNX vào volume dùng
chung rồi tự xoá. Ảnh `speech` không hề bị đụng tới.

Kiểm tra `curl http://127.0.0.1:8000/health` phải thấy `"gop_ready": true`.

---

## 2. Dựng web

```powershell
pnpm db:push            # tạo data/app.db
pnpm dev                # http://localhost:3000
```

Mở `http://localhost:3000`, **bấm giữ** nút, nói một câu tiếng Anh ngắn, thả ra.

> Micro chỉ hoạt động ở `localhost` hoặc HTTPS. Mở bằng địa chỉ IP của máy sẽ bị trình duyệt chặn.

---

## 3. Hiệu chỉnh ngưỡng — làm trước khi luyện

Vào `http://localhost:3000/calibrate`. Đọc 20 câu **ở trạng thái tốt nhất của bạn**:
đọc chậm, rõ, phòng yên tĩnh. Xong bấm *Tính ngưỡng từ giọng của tôi*.

GOP là số âm không có thang đo, nên ngưỡng lấy từ giọng người khác sẽ sai. Hệ thống lấy
phân bố điểm của chính bạn rồi cắt ở phân vị 25 và 10. Mất khoảng mười phút, làm một lần.

Chưa hiệu chỉnh thì app **không tô màu** — chỉ hiện điểm thô khi bấm vào từ. Đó là cố ý:
im lặng tốt hơn tô sai.

Kết quả ghi ở `data/gop-calibration.json`, xoá file đó là hiệu chỉnh lại từ đầu.

---

## 4. Nghiệm thu

**Cuối tuần 1**

| Kiểm tra | Đạt |
|---|---|
| Nói một câu ở `/freetalk`, thấy nó thành chữ | ✅ |
| Bấm "Nghe giọng mẫu", nghe được | ✅ |
| Lượt thứ hai trở đi nhanh hơn hẳn lượt đầu | Whisper đã nạp sẵn |
| `nvidia-smi` khi đang chép lời | **≤ 5,5GB** trên Windows |

**Cuối tuần 2**

| Kiểm tra | Đạt |
|---|---|
| Đọc đúng cả câu | phần lớn từ xanh |
| **Cố tình đọc sai một từ** | **đúng từ đó đỏ lên** |
| Bấm vào từ đỏ | thấy từng âm vị, và âm sai ghi *nghe giống /…/* |
| Đọc lại đúng từ đó | nó chuyển xanh |

Một điểm cần biết khi đọc kết quả: **âm ngay sau âm đọc sai thường cũng bị tụt điểm.**
Căn chỉnh cưỡng bức phải nhét những khung âm thanh không khớp vào đâu đó, nên chúng trôi
sang âm kế bên. Vì vậy giao diện khoanh đậm **âm tệ nhất** — đó mới là chỗ cần sửa,
âm kế bên chỉ là vạ lây.

Con số độ trễ hiện ngay cạnh kết quả. Lượt đầu chậm vì phải nạp model — bỏ qua,
tính từ lượt thứ hai.

---

## 5. Khi có trục trặc

| Hiện tượng | Xử lý |
|---|---|
| `Không kết nối được speech-service` | `pnpm speech:logs`. Container chưa lên hoặc đã chết |
| `Chưa có trọng số Kokoro` | Chạy `fetch-kokoro.sh` ở bước 1. Nếu URL 404 thì tra lại link release rồi sửa hai dòng trong script |
| Chép lời rất chậm, trên 5 giây | Whisper đang chạy CPU. `pnpm speech:logs` xem có dòng *Không nạp được Whisper trên cuda* không |
| Hết VRAM | Tắt tăng tốc phần cứng ở trình duyệt. Vẫn không đủ thì đặt `WHISPER_MODEL: base` trong `docker/compose.yml` |
| Không truy cập được micro | Phải mở qua `localhost`, không phải IP |
| Docker ăn hết RAM | Đặt `.wslconfig` ở bước 0, rồi `wsl --shutdown` |
| `Chưa có mô hình chấm phát âm` | Chạy bước 1b |
| Chấm phát âm báo 422 | Audio ngắn hơn câu đích. Đọc đủ câu, đừng thả nút sớm |
| Một từ luôn đỏ dù đọc đúng | Có thể espeak sinh âm ngoài vocab — bấm vào từ, xem dòng `bỏ qua:` |
| Mọi từ đều đỏ | Ngưỡng hiệu chỉnh từ bản ghi kém. Xoá và hiệu chỉnh lại ở `/calibrate` |

---

## 6. Những gì chưa có

Đúng phạm vi, không phải thiếu sót:

- **Hội thoại với Ollama** — cuối tuần 3. Chưa cần cài Ollama lúc này.
- **Flashcard SRS** — cuối tuần 4.
- **Silero VAD trong trình duyệt** — hiện là bấm-giữ-để-nói. VAD chỉ cần khi hội thoại
  phải tự biết lúc nào người học nói xong, tức là từ cuối tuần 3.
- **shadcn/ui** — Tailwind đã có, thư viện component thêm khi UI đủ nhiều để cần.
