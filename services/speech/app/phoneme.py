"""Mô hình nhận diện âm vị (wav2vec2 CTC) chạy ONNX Runtime trên CPU.

Cố ý chạy CPU: VRAM 6GB là tài nguyên khan hiếm nhất, còn 32GB RAM thì dư.
Và nó chạy song song với Whisper trên GPU nên không cộng vào tổng độ trễ.
Xem docs/PLAN-LOCAL.md mục 2.
"""
from __future__ import annotations

import json
import logging
import os

import numpy as np

from . import config

log = logging.getLogger(__name__)

_session = None
_vocab: dict[str, int] = {}
_id_to_phone: dict[int, str] = {}


class ModelsMissing(RuntimeError):
    """Chưa xuất ONNX — thông điệp kèm sẵn lệnh cần chạy."""


def available() -> bool:
    return os.path.exists(config.GOP_ONNX) and os.path.exists(config.GOP_VOCAB)


def _load():
    global _session, _vocab, _id_to_phone
    if _session is not None:
        return _session

    if not available():
        raise ModelsMissing(
            "Chưa có mô hình chấm phát âm. Chạy một lần: "
            "docker compose -f docker/compose.yml run --rm tools"
        )

    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = config.OMP_NUM_THREADS
    _session = ort.InferenceSession(
        config.GOP_ONNX, sess_options=opts, providers=["CPUExecutionProvider"]
    )
    with open(config.GOP_VOCAB, encoding="utf-8") as fh:
        _vocab = json.load(fh)
    _id_to_phone = {v: k for k, v in _vocab.items()}
    log.info("Nạp mô hình chấm phát âm, vocab %d âm vị", len(_vocab))
    return _session


def vocab() -> dict[str, int]:
    _load()
    return _vocab


def phone_of(idx: int) -> str:
    _load()
    return _id_to_phone.get(idx, f"<{idx}>")


def blank_id() -> int:
    v = vocab()
    for key in ("<pad>", "<blank>", "<s>"):
        if key in v:
            return v[key]
    return 0


def log_probs(waveform: np.ndarray) -> np.ndarray:
    """waveform: mono float32 16kHz. Trả về (T, V) đã log-softmax."""
    session = _load()

    # Chuẩn hoá zero-mean unit-variance, đúng như feature extractor của model.
    x = waveform.astype(np.float32)
    x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)

    logits = session.run(None, {session.get_inputs()[0].name: x[None, :]})[0][0]
    logits = logits.astype(np.float64)
    logits -= logits.max(axis=1, keepdims=True)
    return logits - np.log(np.exp(logits).sum(axis=1, keepdims=True))
