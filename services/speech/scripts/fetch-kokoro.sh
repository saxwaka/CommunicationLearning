#!/usr/bin/env bash
# Tải trọng số Kokoro vào volume cache. Chạy một lần:
#   docker compose -f docker/compose.yml exec speech bash scripts/fetch-kokoro.sh
#
# Nếu URL đổi, tra lại ở trang release của kokoro-onnx rồi sửa hai dòng dưới.
set -euo pipefail

DIR="${KOKORO_DIR:-/cache/kokoro}"
BASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

mkdir -p "$DIR"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ -f "$DIR/$f" ]; then
    echo "đã có: $f"
  else
    echo "đang tải: $f"
    curl -fL --retry 3 -o "$DIR/$f" "$BASE/$f"
  fi
done
echo "xong. Khởi động lại speech-service để nạp: docker compose -f docker/compose.yml restart speech"
