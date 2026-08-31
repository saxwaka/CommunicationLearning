"""Kiểm thử phần toán GOP bằng log-prob tự dựng — không cần model, không cần GPU."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.gop import AlignmentError, assess, compute_gop, ctc_forced_align  # noqa: E402

BLANK = 0
# Vocab giả: 0=blank, 1=/k/, 2=/æ/, 3=/n/, 4=/s/, 5=/θ/
V = 6


def frames(spec: list[tuple[int, int, float]]) -> np.ndarray:
    """Dựng log-prob: mỗi phần tử là (số khung, id áp đảo, xác suất của id đó)."""
    rows = []
    for count, dominant, p in spec:
        for _ in range(count):
            rest = (1.0 - p) / (V - 1)
            row = np.full(V, rest)
            row[dominant] = p
            rows.append(row)
    return np.log(np.array(rows))


def test_can_can_doc_dung_thi_gop_gan_khong():
    # /k/ /æ/ /n/, mỗi âm 3 khung, đọc rất rõ.
    log_probs = frames([(3, 1, 0.9), (3, 2, 0.9), (3, 3, 0.9)])
    scores = assess(log_probs, [1, 2, 3], BLANK)

    assert [s.phone_id for s in scores] == [1, 2, 3]
    for s in scores:
        assert s.gop == pytest.approx(0.0, abs=1e-9), f"âm {s.phone_id} lẽ ra phải đúng"
        assert s.competitor_id == s.phone_id


def test_am_doc_sai_bi_diem_thap_va_chi_dung_thu_pham():
    # Âm giữa lẽ ra là /æ/ (id 2) nhưng người học phát ra /s/ (id 4).
    log_probs = frames([(3, 1, 0.9), (3, 4, 0.9), (3, 3, 0.9)])
    scores = assess(log_probs, [1, 2, 3], BLANK)

    bad = scores[1]
    assert bad.gop < -1.0, "âm đọc sai phải bị điểm thấp rõ rệt"
    assert bad.competitor_id == 4, "phải chỉ ra được người học đã đọc thành âm nào"
    assert bad.gop == min(s.gop for s in scores), "âm sai phải là âm tệ nhất"

    # Âm đầu nằm trước chỗ sai nên vẫn sạch.
    assert scores[0].gop == pytest.approx(0.0, abs=1e-9)

    # Âm sau thì KHÔNG sạch, và đó là đúng: căn chỉnh cưỡng bức phải nhét những
    # khung /s/ thừa vào đâu đó, nên chúng trôi sang âm kế bên. Đây là tính chất
    # cố hữu của forced alignment, không phải lỗi.
    #
    # Hệ quả cho giao diện: đừng bôi đỏ mọi âm dưới ngưỡng như nhau, mà nhấn vào
    # âm tệ nhất — âm kế bên chỉ là vạ lây.
    assert scores[2].gop < 0
    assert bad.gop < scores[2].gop - 1.0, "âm sai phải tệ hơn hẳn âm bị vạ lây"


def test_can_chinh_tach_dung_ranh_gioi_cac_am():
    log_probs = frames([(2, 1, 0.95), (5, 2, 0.95), (3, 3, 0.95)])
    spans = ctc_forced_align(log_probs, [1, 2, 3], BLANK)

    assert spans[0][0] == 0
    assert spans[-1][1] == 10
    # Các đoạn phải liền nhau, không chồng lấn, không bỏ trống.
    for (_, end), (start, _) in zip(spans, spans[1:]):
        assert start == end
    # Âm giữa dài nhất vì nó chiếm 5 khung.
    lengths = [e - s for s, e in spans]
    assert lengths[1] == max(lengths)


def test_hai_am_giong_nhau_lien_ke_khong_bi_dinh_lam_mot():
    # Chuỗi đích /n/ /n/ — CTC bắt buộc phải có blank chen giữa.
    log_probs = frames([(2, 3, 0.8), (2, BLANK, 0.8), (2, 3, 0.8)])
    spans = ctc_forced_align(log_probs, [3, 3], BLANK)

    assert len(spans) == 2
    assert spans[0][1] <= spans[1][0], "hai âm phải nằm ở hai đoạn tách biệt"


def test_audio_qua_ngan_thi_bao_loi_ro_rang():
    log_probs = frames([(2, 1, 0.9)])
    with pytest.raises(AlignmentError):
        ctc_forced_align(log_probs, [1, 2, 3, 4, 5], BLANK)


def test_chuoi_dich_rong_thi_bao_loi():
    with pytest.raises(AlignmentError):
        ctc_forced_align(frames([(3, 1, 0.9)]), [], BLANK)


def test_gop_khong_bao_gio_duong():
    rng = np.random.default_rng(7)
    logits = rng.normal(size=(40, V))
    log_probs = logits - np.log(np.exp(logits).sum(axis=1, keepdims=True))
    scores = assess(log_probs, [1, 2, 3, 4, 5], BLANK)

    assert len(scores) == 5
    for s in scores:
        assert s.gop <= 1e-9, "GOP theo định nghĩa không thể dương"


def test_blank_khong_duoc_tinh_la_am_canh_tranh():
    # Khung toàn blank áp đảo: âm cạnh tranh vẫn phải là một âm vị thật.
    log_probs = frames([(4, BLANK, 0.9)])
    scores = compute_gop(log_probs, [1], [(0, 4)], BLANK)

    assert scores[0].competitor_id != BLANK
    assert scores[0].gop == pytest.approx(0.0, abs=1e-9), (
        "mọi âm vị thật đều đồng khả năng nên âm đích cũng là tốt nhất"
    )
