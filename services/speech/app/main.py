"""speech-service — stateless.

Nhận bytes audio trong thân request, trả JSON hoặc bytes audio.
Không đụng vào đĩa của Windows: xem docs/SPEC.md mục 9.2.
"""
import logging
import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import config, stt, tts

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("speech")

app = FastAPI(title="speech-service", version="0.1.0")

MAX_BYTES = 10 * 1024 * 1024


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "whisper": stt.loaded_as() or f"{config.WHISPER_MODEL} (chưa nạp)",
        "tts_ready": tts.available(),
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(400, "Bản ghi rỗng.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Bản ghi quá dài.")

    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(data)
        tmp.close()
        text, duration_ms, model = stt.transcribe(tmp.name)
    except Exception as err:
        log.exception("Chép lời thất bại")
        raise HTTPException(500, f"Chép lời thất bại: {err}") from err
    finally:
        os.unlink(tmp.name)

    return {"text": text, "model": model, "duration_ms": duration_ms}


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    voice: str | None = None
    speed: float | None = Field(default=None, gt=0.3, le=2.0)


@app.post("/tts")
def synthesize(req: TtsRequest) -> Response:
    try:
        wav = tts.synthesize(req.text, req.voice, req.speed)
    except tts.ModelsMissing as err:
        raise HTTPException(503, str(err)) from err
    except Exception as err:
        log.exception("Tổng hợp giọng nói thất bại")
        raise HTTPException(500, f"Tổng hợp giọng nói thất bại: {err}") from err
    return Response(content=wav, media_type="audio/wav")
