# Khảo sát mô hình ngôn ngữ — tháng 8/2026

> Câu hỏi: có gì tốt hơn Qwen3-4B cho khe 6GB VRAM không? Khảo sát ngày 2026-08-27.
> **Kết luận: có — nhưng không phải model mới hơn, mà là biến thể đúng của chính Qwen3-4B.**

---

## 1. Ràng buộc của bài toán

Trước khi so mô hình, cần nhớ **việc mà LLM thật sự phải làm** trong app này rất hẹp (xem `PLAN-LOCAL.md` mục 3):

1. Phân loại câu người học vào một nhánh của đồ thị trạng thái.
2. Diễn đạt lại câu mẫu có sẵn cho tự nhiên hơn.
3. Sửa lỗi ngữ pháp câu người học.
4. Trả về JSON đúng schema.

**Nó gần như không phải sinh tiếng Việt.** Mọi giải thích tiếng Việt — mẹo phát âm, nghĩa từ, hướng dẫn — đều là nội dung tĩnh viết sẵn trong `content/*.yaml`.

Hệ quả quan trọng: **đừng đi tìm mô hình giỏi tiếng Việt.** Cái cần là **bám sát chỉ dẫn và trả JSON đáng tin ở cỡ 4B**, cộng độ trễ thấp. Đây là lý do phần lớn ứng viên "chuyên tiếng Việt" bên dưới bị loại, và không phải vì chúng kém.

Khe VRAM còn lại cho LLM sau khi trừ Whisper (0,6GB), KV cache (0,4GB) và CUDA context (0,3GB): **tối đa khoảng 3,5GB trên Linux, 2,8GB trên Windows.**

---

## 2. Phát hiện quan trọng nhất — không phải chuyện model mới

Bản chốt trước ghi `qwen3:4b`. Đó là **mô hình lai có chế độ suy nghĩ**: nó có thể tự phát ra khối `<think>…</think>` dài trước khi trả lời.

Với app này, đó là một lỗi chứ không phải tính năng:

- **Phá ngân sách độ trễ.** Vài trăm token suy nghĩ ở tốc độ ~22 tok/s là cộng thêm 5–10 giây cho một lượt nói lẽ ra chỉ mất 2 giây.
- **Phá ràng buộc JSON schema.** Khối suy nghĩ nằm ngoài schema, phải bóc tách thủ công, và bóc sai là hỏng lượt.
- **Không mang lại gì.** Phân loại một câu A0 vào một trong bốn nhánh không cần suy luận nhiều bước.

**Bản cần dùng là [`Qwen3-4B-Instruct-2507`](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)** — biến thể *không suy nghĩ*, đồng thời là bản làm mới của Qwen3-4B với cải thiện đáng kể ở khoản bám chỉ dẫn, hiểu văn bản và kiến thức đa ngữ. Trên [Artificial Analysis](https://artificialanalysis.ai/models/qwen3-4b-2507-instruct) nó đạt 7 điểm Intelligence Index, trong khi trung bình nhóm cùng cỡ là 3.

Cùng kích thước, cùng VRAM, cùng giấy phép Apache 2.0. **Đây là nâng cấp không mất gì** — và quan trọng hơn, nó sửa một lỗi tiềm ẩn trong bản chốt cũ.

GGUF có sẵn ở [`unsloth/Qwen3-4B-Instruct-2507-GGUF`](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF) và bản `lmstudio-community`.

> Nếu vì lý do nào đó vẫn dùng `qwen3:4b` gốc, **bắt buộc phải tắt chế độ suy nghĩ** (thêm `/no_think` vào prompt hoặc đặt tham số tương ứng) và kiểm tra lại đầu ra không còn khối `<think>`.

---

## 3. Các ứng viên đã cân nhắc

### Qwen3.5-4B — mới hơn, nhưng chưa chốt

[Qwen3.5](https://unsloth.ai/docs/models/qwen3.5) ra tháng 2–3/2026, nhóm model nhỏ (0.8B, 2B, 4B, 9B) phát hành ngày 2/3/2026, toàn bộ Apache 2.0. Bản 4B có ngữ cảnh 256K và [có mặt trên Ollama](https://ollama.com/library/qwen3.5:4b).

Vì sao **chưa** đổi sang nó:

- **Là mô hình đa phương thức** (nhận cả ảnh và video). Dùng ở chế độ chỉ-văn-bản thì không cần file `mmproj`, nhưng phần đóng gói phức tạp hơn và có báo cáo về **trục trặc GGUF trên Ollama do file vision tách rời**.
- Bản tải khoảng **3,4GB** — vẫn vừa khe 3,5GB nhưng sát mép, và trên Windows thì không vừa.
- Lợi ích cho công việc hẹp ở mục 1 chưa rõ có đáng phần rủi ro thêm hay không.

**Xử lý:** thử ở buổi tối số 0 như một phép thử phụ. Nếu chạy trơn và nhanh hơn thì đổi; không thì giữ Instruct-2507. Đừng để việc này chặn tiến độ.

### Gemma 4 — loại vì không vừa

[Gemma 4 ra ngày 31/3/2026](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemma-4-12b/), và **đổi sang giấy phép Apache 2.0** — điều này xóa bỏ e ngại về "Gemma Terms" mà bản `PLAN.md` từng nêu với Gemma 3. Hỗ trợ 140+ ngôn ngữ, có tiếng Việt.

Nhưng bản E4B — cỡ nhỏ nhất còn đủ mạnh — có [file `Q4_K_M` nặng **4,98GB**](https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/blob/main/gemma-4-E4B-it-Q4_K_M.gguf). Cộng KV cache, Whisper và CUDA context là **vượt 6GB**. Kiến trúc Per-Layer Embeddings khiến nó nặng hơn nhiều so với cảm giác từ cái tên "E4B".

Bản E2B thì vừa (~3GB) nhưng là cỡ dành cho điện thoại, yếu hơn Qwen3-4B ở khoản bám chỉ dẫn.

**Loại** — không phải vì kém, mà vì không vừa khe.

### Model chuyên Đông Nam Á — loại vì cỡ

| Model | Cỡ | Vì sao loại |
|---|---|---|
| [SEA-LION v3](https://arxiv.org/html/2504.05747v4) (Llama 8B / Gemma 9B) | 8–9B | ~5GB ở Q4, không còn chỗ cho Whisper |
| [Sailor2](https://sea-sailor.github.io/blog/sailor1/)-8B | 8B | Như trên |
| SeaLLMs v3 | 7B | Như trên |
| Sailor2-1B | 1B | Vừa thoải mái, nhưng quá yếu để trả JSON đáng tin |

Không có model chuyên Đông Nam Á nào rơi đúng vào khe 2,5–3,5GB. Và theo lập luận ở mục 1, **ta cũng không cần** — tiếng Việt trong app là nội dung tĩnh, không phải đầu ra của model.

### Finetune tiếng Việt trên HuggingFace — không tìm thấy ứng viên phù hợp

Các dòng finetune tiếng Việt được nhắc tới nhiều (VinaLLaMA, Vi-Mistral-X, PhoGPT, GemSUra, Vistral) đều dựa trên nền **Llama-2, Mistral-7B hoặc Gemma đời cũ**, cỡ 7B trở lên, và phần lớn ra đời 2024–2025 — tức là nền tảng yếu hơn Qwen3-4B-Instruct-2507 ở khoản bám chỉ dẫn, mà lại nặng gấp đôi.

Chưa thấy finetune tiếng Việt nào trên nền Qwen3-4B hoặc Qwen3.5-4B đủ chín để đưa vào sản phẩm.

**Kết luận:** không dùng finetune tiếng Việt. Nếu sau này cần tiếng Việt tốt hơn, cách hiệu quả hơn nhiều là **viết nội dung tĩnh cho tốt**, không phải đổi model.

### SmolLM3-3B — đáng biết, chưa cần

3B, hoàn toàn mở, được ghi nhận vượt Llama-3.2-3B và Qwen2.5-3B ở cùng cỡ. Nhẹ hơn Qwen3-4B khoảng 0,7GB. Nhưng độ phủ đa ngữ hẹp hơn và không có lợi thế rõ ràng cho công việc ở mục 1. Ghi lại làm phương án nếu VRAM căng hơn dự kiến.

---

## 4. Một hướng thử nghiệm: MoE với expert đẩy sang RAM

Đây là thứ đáng biết vì máy có **32GB RAM**, nhiều hơn hẳn mức cần thiết.

Qwen3.5 có bản **35B-A3B** — Mixture-of-Experts, 35B tổng nhưng chỉ 3B tham số hoạt động mỗi lượt, Apache 2.0. Kỹ thuật `--n-cpu-moe` của llama.cpp cho phép giữ lớp attention trên GPU và đẩy toàn bộ expert xuống RAM. [Có báo cáo chạy được trên 6GB VRAM](https://mychen76.medium.com/run-qwen3-6-35b-a3b-on-6gb-vram-using-llama-cpp-30-tps-a89032e5a60c).

Ước lượng cho máy này: bản Q4 chiếm khoảng 20GB RAM. Tốc độ bị chặn bởi băng thông RAM — DDR4-3200 hai kênh cho khoảng 51 GB/s, mỗi lượt phải đọc ~1,8GB, tức trần lý thuyết ~28 tok/s và thực tế nhiều khả năng **10–15 tok/s**.

Đổi lại: một mô hình thông minh hơn hẳn 4B.

**Không đưa vào bản chốt.** Ba lý do: chậm hơn Qwen3-4B chạy thẳng trên GPU, ăn 20 trong 32GB RAM, và chưa ai kiểm chứng trên Pascal. Nhưng nếu tới cuối tuần 3 mà thấy 4B trả lời ngớ ngẩn, đây là thứ đáng thử **trước khi** nghĩ tới chuyện mua card.

---

## 5. Chốt lại

| | Chốt cũ | Chốt mới |
|---|---|---|
| Model | `qwen3:4b` (lai, có chế độ suy nghĩ) | **`Qwen3-4B-Instruct-2507`** (không suy nghĩ) |
| VRAM | ~2,5GB | ~2,5GB, không đổi |
| Giấy phép | Apache 2.0 | Apache 2.0, không đổi |
| Lý do đổi | | Tránh khối `<think>` phá độ trễ và phá JSON schema; bản làm mới bám chỉ dẫn tốt hơn |

**Thử thêm ở buổi tối số 0 (không chặn tiến độ):** Qwen3.5-4B ở chế độ chỉ-văn-bản. Chạy trơn và nhanh hơn thì đổi.

**Để dành khi cần:** Qwen3.5-35B-A3B với expert đẩy sang RAM, nếu 4B tỏ ra không đủ.

**Đã loại:** Gemma 4 E4B (4,98GB, không vừa) · SEA-LION v3, Sailor2, SeaLLM (8B trở lên) · các finetune tiếng Việt (nền cũ, cỡ lớn) · Sailor2-1B (quá yếu).

**Một điểm cần sửa trong `PLAN.md`:** tài liệu đó xếp Gemma vào nhóm "giấy phép không phải OSI". Điều đó đúng với Gemma 3, nhưng **Gemma 4 đã chuyển sang Apache 2.0**. Không ảnh hưởng tới lựa chọn ở đây vì Gemma 4 E4B bị loại do kích thước, nhưng cần ghi lại cho đúng.
