"""ブラウザ側(src/features/recognize/preprocess.ts)と同じそろえ方。

学習と本番で手順がずれると、精度はそこで落ちる。ここが唯一の写し元。
"""

import base64

import numpy as np

MODEL_SIZE = 28
MODEL_BOX = 20
INK = 0.05


def unpack(sample):
    """試し場から送られた見本(1bit)を (size, size) の 0/1 へ"""
    size = sample["size"]
    raw = np.frombuffer(base64.b64decode(sample["ink"]), dtype=np.uint8)
    bits = np.unpackbits(raw)[: size * size]
    return bits.reshape(size, size).astype(np.float32)


def normalize_gray(ink):
    """囲みを切る → 長いほうを MODEL_BOX に収める → 重心を中央へ"""
    rows = np.where(ink.any(axis=1))[0]
    cols = np.where(ink.any(axis=0))[0]
    if len(rows) == 0:
        return None
    cut = ink[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1]

    height, width = cut.shape
    scale = MODEL_BOX / max(height, width)
    step = 1 / scale
    to_h, to_w = max(1, round(height * scale)), max(1, round(width * scale))

    cells = np.zeros((to_h, to_w), dtype=np.float32)
    for y in range(to_h):
        for x in range(to_w):
            y0, x0 = y * step, x * step
            block = cut[int(y0) : int(min(height, y0 + step)), int(x0) : int(min(width, x0 + step))]
            cells[y, x] = block.mean() if block.size else 0

    mask = cells >= INK
    weight = cells[mask].sum()
    if weight == 0:
        return None
    ys, xs = np.mgrid[0:to_h, 0:to_w]
    cy = (ys * cells * mask).sum() / weight
    cx = (xs * cells * mask).sum() / weight
    offset_y, offset_x = round(MODEL_SIZE / 2 - cy), round(MODEL_SIZE / 2 - cx)

    out = np.zeros((MODEL_SIZE, MODEL_SIZE), dtype=np.float32)
    for y in range(to_h):
        for x in range(to_w):
            ty, tx = y + offset_y, x + offset_x
            if 0 <= ty < MODEL_SIZE and 0 <= tx < MODEL_SIZE:
                out[ty, tx] = cells[y, x]
    return out
