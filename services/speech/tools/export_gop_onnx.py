"""Xuất wav2vec2 nhận âm vị sang ONNX. Chạy MỘT LẦN.

Chạy trong container `tools` riêng có PyTorch, ghi kết quả vào volume dùng chung.
Ảnh runtime của speech-service nhờ vậy vẫn không cần PyTorch — xem
docs/PLAN-LOCAL.md mục 3.3.

    docker compose -f docker/compose.yml run --rm tools
"""
import json
import os
import sys

OUT_DIR = os.getenv("GOP_DIR", "/cache/gop")
MODEL_ID = os.getenv("GOP_HF_ID", "facebook/wav2vec2-lv-60-espeak-cv-ft")


def main() -> int:
    import torch
    from transformers import AutoProcessor, Wav2Vec2ForCTC

    os.makedirs(OUT_DIR, exist_ok=True)
    onnx_path = os.path.join(OUT_DIR, "model.onnx")
    vocab_path = os.path.join(OUT_DIR, "vocab.json")

    if os.path.exists(onnx_path) and os.path.exists(vocab_path):
        print(f"Đã có sẵn ở {OUT_DIR} — bỏ qua.")
        return 0

    print(f"Tải {MODEL_ID} …")
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID).eval()

    vocab = processor.tokenizer.get_vocab()
    with open(vocab_path, "w", encoding="utf-8") as fh:
        json.dump(vocab, fh, ensure_ascii=False, indent=1)
    print(f"Vocab {len(vocab)} âm vị → {vocab_path}")

    dummy = torch.zeros(1, 16000 * 3)  # 3 giây
    print("Đang xuất ONNX …")
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["input_values"],
        output_names=["logits"],
        # Độ dài audio thay đổi theo từng lượt nói, nên trục thời gian phải động.
        dynamic_axes={"input_values": {0: "batch", 1: "samples"},
                      "logits": {0: "batch", 1: "frames"}},
        opset_version=17,
    )
    size_mb = os.path.getsize(onnx_path) / 1e6
    print(f"Xong: {onnx_path} ({size_mb:.0f} MB)")
    print("Khởi động lại speech-service: docker compose -f docker/compose.yml restart speech")
    return 0


if __name__ == "__main__":
    sys.exit(main())
