"""Cấu hình đọc từ biến môi trường. Giá trị mặc định khớp docs/SPEC.md mục 5."""
import os

# Whisper. compute_type PHẢI là "int8" trên Pascal — "int8_float16" chậm hơn,
# vì GTX 1060 không có Tensor Core và đường FP16 chạy ở ~1/64 tốc độ FP32.
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cuda")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "en")

# Kokoro
KOKORO_DIR = os.getenv("KOKORO_DIR", "/cache/kokoro")
KOKORO_MODEL = os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx")
KOKORO_VOICES = os.path.join(KOKORO_DIR, "voices-v1.0.bin")
TTS_VOICE = os.getenv("TTS_VOICE", "af_heart")
TTS_SPEED = float(os.getenv("TTS_SPEED", "0.85"))

# Chấm phát âm — wav2vec2 nhận âm vị, ONNX trên CPU.
GOP_DIR = os.getenv("GOP_DIR", "/cache/gop")
GOP_ONNX = os.path.join(GOP_DIR, "model.onnx")
GOP_VOCAB = os.path.join(GOP_DIR, "vocab.json")
GOP_HF_ID = os.getenv("GOP_HF_ID", "facebook/wav2vec2-lv-60-espeak-cv-ft")

# Chừa 1 nhân cho hệ điều hành (Ryzen 5 5600 có 6 nhân).
OMP_NUM_THREADS = int(os.getenv("OMP_NUM_THREADS", "5"))
