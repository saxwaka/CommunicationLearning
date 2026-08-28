"""Tổng hợp giọng nói bằng Kokoro-82M (ONNX, chạy CPU)."""
import io
import logging
import os

from . import config

log = logging.getLogger(__name__)
_kokoro = None


class ModelsMissing(RuntimeError):
    """Trọng số chưa được tải — thông điệp kèm sẵn lệnh cần chạy."""


def available() -> bool:
    return os.path.exists(config.KOKORO_MODEL) and os.path.exists(config.KOKORO_VOICES)


def _load():
    global _kokoro
    if _kokoro is not None:
        return _kokoro
    if not available():
        raise ModelsMissing(
            "Chưa có trọng số Kokoro. Chạy: docker compose -f docker/compose.yml "
            "exec speech bash scripts/fetch-kokoro.sh"
        )
    from kokoro_onnx import Kokoro

    _kokoro = Kokoro(config.KOKORO_MODEL, config.KOKORO_VOICES)
    return _kokoro


def synthesize(text: str, voice: str | None = None, speed: float | None = None) -> bytes:
    """Trả về WAV bytes."""
    import soundfile as sf

    kokoro = _load()
    samples, sample_rate = kokoro.create(
        text,
        voice=voice or config.TTS_VOICE,
        speed=speed if speed is not None else config.TTS_SPEED,
        lang="en-us",
    )
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    return buf.getvalue()
