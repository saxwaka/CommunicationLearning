# Container dùng một lần để xuất ONNX. Có PyTorch — và đó chính là lý do nó
# tách khỏi ảnh runtime, để speech-service không phải mang theo 2,5GB torch.
# Chạy: docker compose -f docker/compose.yml run --rm tools
FROM python:3.12-slim

RUN pip install --no-cache-dir \
      torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir \
      transformers==4.48.0 onnx==1.17.0

WORKDIR /srv
COPY export_gop_onnx.py .
CMD ["python", "export_gop_onnx.py"]
