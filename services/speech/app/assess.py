"""Ghép nối: audio + văn bản đích → điểm phát âm theo từ và theo âm vị."""
from __future__ import annotations

import logging
import time

from . import gop, phoneme, text as textmod

log = logging.getLogger(__name__)

FRAME_MS = 20.0  # wav2vec2 cho một khung mỗi 20ms


def assess(waveform, target_text: str) -> dict:
    started = time.perf_counter()

    vocab = phoneme.vocab()
    words = textmod.to_words(target_text, vocab)
    if not words:
        raise ValueError("Không rút được âm vị nào từ câu đích.")

    targets: list[int] = []
    for w in words:
        targets.extend(vocab[p] for p in w.phones)

    lp = phoneme.log_probs(waveform)
    scores = gop.assess(lp, targets, phoneme.blank_id())

    # Chia điểm âm vị về đúng từ.
    out_words, cursor = [], 0
    for w in words:
        chunk = scores[cursor : cursor + len(w.phones)]
        cursor += len(w.phones)
        out_words.append(
            {
                "text": w.text,
                "gop": min((s.gop for s in chunk), default=0.0),
                "gop_mean": sum(s.gop for s in chunk) / len(chunk),
                "dropped": w.dropped,
                "phones": [
                    {
                        "phone": p,
                        "gop": s.gop,
                        "heard_as": phoneme.phone_of(s.competitor_id),
                        "start_ms": s.start_frame * FRAME_MS,
                        "end_ms": s.end_frame * FRAME_MS,
                    }
                    for p, s in zip(w.phones, chunk)
                ],
            }
        )

    all_gops = [s.gop for s in scores]
    return {
        "words": out_words,
        # Điểm câu lấy trung bình; điểm từ lấy MIN của các âm trong từ, vì một
        # âm sai đủ làm cả từ nghe sai — trung bình sẽ giấu mất nó.
        "sentence_gop": sum(all_gops) / len(all_gops),
        "worst_gop": min(all_gops),
        "phone_count": len(all_gops),
        "duration_ms": (time.perf_counter() - started) * 1000,
    }
