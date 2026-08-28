"""Chép lời bằng faster-whisper (CTranslate2, không cần PyTorch)."""
import logging
import time
from typing import Optional

from . import config

log = logging.getLogger(__name__)
_model = None
_loaded_as = ""


def _load():
    """Nạp lười, và tự lùi về CPU nếu GPU không dùng được.

    Pascal + WSL2 + CUDA 12.x là tổ hợp ít người kiểm chứng, nên thà chạy
    chậm trên CPU còn hơn để cả service không lên được.
    """
    global _model, _loaded_as
    if _model is not None:
        return _model

    from faster_whisper import WhisperModel

    for device, compute in (
        (config.WHISPER_DEVICE, config.WHISPER_COMPUTE_TYPE),
        ("cpu", "int8"),
    ):
        try:
            log.info("Đang nạp Whisper %s trên %s (%s)", config.WHISPER_MODEL, device, compute)
            _model = WhisperModel(
                config.WHISPER_MODEL,
                device=device,
                compute_type=compute,
                cpu_threads=config.OMP_NUM_THREADS,
            )
            _loaded_as = f"{config.WHISPER_MODEL}/{device}/{compute}"
            return _model
        except Exception:
            log.exception("Không nạp được Whisper trên %s", device)
            if device == "cpu":
                raise
    raise RuntimeError("unreachable")


def loaded_as() -> str:
    return _loaded_as


def transcribe(path: str) -> tuple[str, float, str]:
    """Trả về (text, thời_gian_xử_lý_ms, tên_model)."""
    model = _load()
    started = time.perf_counter()
    segments, _info = model.transcribe(
        path,
        language=config.WHISPER_LANGUAGE,
        beam_size=1,          # một người dùng, ưu tiên độ trễ hơn 1-2% độ chính xác
        vad_filter=True,      # cắt khoảng lặng đầu/cuối
        condition_on_previous_text=False,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return text, (time.perf_counter() - started) * 1000, _loaded_as
