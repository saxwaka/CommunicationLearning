# CUDA 12.x bắt buộc — nhánh 13 đã bỏ hỗ trợ Pascal (GTX 1060, CC 6.1).
# Nếu tag này không kéo được, thử 12.4.1-cudnn-runtime-ubuntu20.04
# hoặc một bản 12.x khác. Tuyệt đối không dùng 13.x.
ARG CUDA_IMAGE=nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04
FROM ${CUDA_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/cache/huggingface \
    KOKORO_DIR=/cache/kokoro

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip libsndfile1 curl ca-certificates \
      espeak-ng libespeak-ng1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
