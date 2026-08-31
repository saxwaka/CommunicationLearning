"""Goodness of Pronunciation — phần toán thuần numpy.

Tách riêng khỏi mọi thứ liên quan tới model để kiểm thử được bằng dữ liệu tự dựng.
Không import onnxruntime, không import phonemizer.

Ý tưởng (xem docs/PLAN-LOCAL.md mục 5):

    GOP(p) = log P(p | khung âm thanh) − max  log P(q | khung âm thanh)
                                        q ≠ blank

Nói nôm na: âm vị *đáng lẽ phải nói* thuyết phục kém hơn âm vị *nghe giống nhất*
bao nhiêu. Bằng 0 nghĩa là đọc đúng; càng âm càng sai.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

NEG_INF = -1e30


class AlignmentError(RuntimeError):
    """Không căn chỉnh được — thường vì audio quá ngắn so với câu đích."""


@dataclass
class PhoneScore:
    index: int          # vị trí trong chuỗi âm vị đích
    phone_id: int
    start_frame: int
    end_frame: int      # nửa mở: [start, end)
    gop: float          # <= 0
    competitor_id: int  # âm vị mà mô hình nghe giống nhất, để nói "bạn đọc thành /s/"


def ctc_forced_align(log_probs: np.ndarray, targets: list[int], blank: int) -> list[tuple[int, int]]:
    """Căn chỉnh cưỡng bức chuỗi âm vị đích vào các khung, bằng Viterbi trên lưới CTC.

    log_probs: (T, V) đã qua log-softmax.
    targets:   chuỗi id âm vị đích, không chứa blank.
    Trả về [(khung_bắt_đầu, khung_kết_thúc)] cho từng âm vị đích, nửa mở.
    """
    if not targets:
        raise AlignmentError("Chuỗi âm vị đích rỗng.")
    T, V = log_probs.shape
    if blank < 0 or blank >= V:
        raise ValueError(f"blank={blank} nằm ngoài vocab kích thước {V}")

    # Chuỗi mở rộng: blank xen giữa mọi âm vị.  z = [b, y1, b, y2, ..., yL, b]
    z = [blank]
    for t in targets:
        z.extend((t, blank))
    S = len(z)

    if T < len(targets):
        raise AlignmentError(f"Audio quá ngắn: {T} khung cho {len(targets)} âm vị.")

    dp = np.full((T, S), NEG_INF, dtype=np.float64)
    back = np.full((T, S), -1, dtype=np.int32)

    dp[0, 0] = log_probs[0, z[0]]
    if S > 1:
        dp[0, 1] = log_probs[0, z[1]]

    for t in range(1, T):
        for s in range(S):
            best, best_prev = dp[t - 1, s], s
            if s >= 1 and dp[t - 1, s - 1] > best:
                best, best_prev = dp[t - 1, s - 1], s - 1
            # Nhảy hai bước chỉ hợp lệ khi s là âm vị thật và khác âm vị s-2,
            # nếu không thì hai âm vị giống nhau liền kề sẽ dính làm một.
            if s >= 2 and z[s] != blank and z[s] != z[s - 2] and dp[t - 1, s - 2] > best:
                best, best_prev = dp[t - 1, s - 2], s - 2
            if best <= NEG_INF:
                continue
            dp[t, s] = best + log_probs[t, z[s]]
            back[t, s] = best_prev

    # Đường đi hợp lệ phải kết ở blank cuối hoặc âm vị cuối.
    end_candidates = [S - 1, S - 2] if S >= 2 else [S - 1]
    end = max(end_candidates, key=lambda s: dp[T - 1, s])
    if dp[T - 1, end] <= NEG_INF:
        raise AlignmentError("Không tìm được đường căn chỉnh hợp lệ.")

    # Truy vết ngược để biết mỗi khung thuộc vị trí mở rộng nào.
    path = np.empty(T, dtype=np.int32)
    s = end
    for t in range(T - 1, -1, -1):
        path[t] = s
        s = back[t, s]
        if s < 0 and t > 0:
            raise AlignmentError("Truy vết căn chỉnh bị đứt.")

    # Vị trí mở rộng 2i+1 tương ứng âm vị đích thứ i.
    spans: list[tuple[int, int]] = []
    for i in range(len(targets)):
        frames = np.flatnonzero(path == 2 * i + 1)
        if frames.size == 0:
            raise AlignmentError(f"Âm vị thứ {i} không được gán khung nào.")
        spans.append((int(frames[0]), int(frames[-1]) + 1))
    return spans


def compute_gop(
    log_probs: np.ndarray,
    targets: list[int],
    spans: list[tuple[int, int]],
    blank: int,
) -> list[PhoneScore]:
    """Tính GOP cho từng âm vị đích trên các khung đã căn chỉnh."""
    if len(targets) != len(spans):
        raise ValueError("Số âm vị và số đoạn căn chỉnh không khớp.")

    # Loại blank khỏi phép lấy max: ta hỏi "nghe giống âm vị nào nhất",
    # chứ không phải "có giống khoảng lặng không".
    masked = log_probs.copy()
    masked[:, blank] = NEG_INF

    scores: list[PhoneScore] = []
    for i, (phone_id, (start, end)) in enumerate(zip(targets, spans)):
        window = masked[start:end]                      # (n, V)
        best_ids = window.argmax(axis=1)
        best_vals = window[np.arange(window.shape[0]), best_ids]
        target_vals = window[:, phone_id]
        gop = float(np.mean(target_vals - best_vals))

        # Âm vị cạnh tranh: cái được chọn nhiều khung nhất trong đoạn.
        competitor = int(np.bincount(best_ids, minlength=log_probs.shape[1]).argmax())
        scores.append(
            PhoneScore(
                index=i,
                phone_id=int(phone_id),
                start_frame=start,
                end_frame=end,
                gop=gop,
                competitor_id=competitor,
            )
        )
    return scores


def assess(log_probs: np.ndarray, targets: list[int], blank: int) -> list[PhoneScore]:
    """Căn chỉnh rồi chấm, trong một bước."""
    return compute_gop(log_probs, targets, ctc_forced_align(log_probs, targets, blank), blank)
