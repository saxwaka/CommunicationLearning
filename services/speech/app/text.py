"""Văn bản đích → chuỗi âm vị IPA, nhóm theo từ.

Dùng espeak-ng qua phonemizer, để khớp với bộ âm vị mà mô hình wav2vec2
`lv-60-espeak-cv-ft` được huấn luyện.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

_WORD_SEP = "|"


@dataclass
class Word:
    text: str
    phones: list[str] = field(default_factory=list)
    # Những âm espeak sinh ra nhưng không có trong vocab của model — bị bỏ qua.
    dropped: list[str] = field(default_factory=list)


def _phonemize(text: str) -> list[list[str]]:
    from phonemizer.backend import EspeakBackend
    from phonemizer.separator import Separator

    backend = EspeakBackend("en-us", with_stress=False, preserve_punctuation=False)
    out = backend.phonemize(
        [text], separator=Separator(word=_WORD_SEP, phone=" "), strip=True
    )[0]
    return [w.split() for w in out.split(_WORD_SEP) if w.strip()]


def to_words(text: str, vocab: dict[str, int]) -> list[Word]:
    """Tách câu thành từ kèm chuỗi âm vị đã lọc theo vocab của model.

    Âm nào espeak sinh ra mà model không biết thì bỏ, và ghi lại vào `dropped`
    để còn gỡ được khi kết quả trông lạ — im lặng nuốt lỗi ở đây là cách nhanh
    nhất để sau này ngồi đoán mò.
    """
    surface = [w for w in re.findall(r"[A-Za-z']+", text) if w]
    groups = _phonemize(text)

    if len(groups) != len(surface):
        # espeak có thể tách/gộp khác với regex; khi đó bỏ ánh xạ theo từ,
        # gom tất cả vào một "từ" để vẫn chấm được ở mức câu.
        log.warning(
            "Số từ không khớp (%d bề mặt / %d espeak) — gom chung câu.",
            len(surface), len(groups),
        )
        surface = [text.strip()]
        groups = [[p for g in groups for p in g]]

    words: list[Word] = []
    for text_w, phones in zip(surface, groups):
        kept, dropped = [], []
        for p in phones:
            (kept if p in vocab else dropped).append(p)
        if dropped:
            log.warning("Từ %r có âm ngoài vocab: %s", text_w, dropped)
        words.append(Word(text=text_w, phones=kept, dropped=dropped))

    return [w for w in words if w.phones]
