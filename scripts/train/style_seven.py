"""日本式の 7 を作る水増し。

実機で集めた見本(scripts/train/.cache/samples.json)から分かった形:

  - 横棒の左に**短い斜めのチョン**を書く
  - そのチョンは本体から**離れている**(間が字の幅の2〜4割空くこともある)
  - 離れたチョンのぶん囲みが左へ広がるので、**本体が右半分に押し込まれる**

MNIST にはこの形が1枚も無く、実機では 4 や 9 と読まれていた。
チョンを足したうえで**もう一度そろえ直す**ところまでやらないと、
本番で起きている「押し込まれ」が再現できない。
"""

import numpy as np

from preprocess import normalize_gray

PAD = 20


def _line(canvas, x0, y0, x1, y1, width):
    h, w = canvas.shape
    ys, xs = np.mgrid[0:h, 0:w]
    dx, dy = x1 - x0, y1 - y0
    length = max(dx * dx + dy * dy, 1e-6)
    t = np.clip(((xs - x0) * dx + (ys - y0) * dy) / length, 0, 1)
    distance = np.hypot(xs - (x0 + t * dx), ys - (y0 + t * dy))
    np.maximum(canvas, np.clip(width - distance, 0, 1), out=canvas)


def add_tick(images, rng):
    """(N, 28, 28) の 7 に、離れたチョンを足してそろえ直す"""
    out = np.empty_like(images)
    for i, image in enumerate(images):
        big = np.zeros((28 + PAD * 2, 28 + PAD * 2), dtype=np.float32)
        big[PAD : PAD + 28, PAD : PAD + 28] = image

        ink = big > 0.3
        if not ink.any():
            out[i] = image
            continue
        rows = np.where(ink.any(axis=1))[0]
        cols = np.where(ink.any(axis=0))[0]
        top, left = rows[0], cols[0]
        height = rows[-1] - rows[0] + 1
        width = cols[-1] - cols[0] + 1

        # 見本から: 長さは高さの1〜2.5割、間は幅の0〜4割、下へ行くほど左へ
        length = rng.uniform(0.10, 0.26) * height
        # 間は幅の4割まで。ただし**縦長のまま**にする(見本はどれも高さのほうが長い)。
        # 横に広げすぎると、そろえ直すときに字が小さく潰れてしまう
        gap = min(rng.uniform(0.0, 0.40) * width, max(0.0, height * 0.9 - width))
        start_x = left - gap
        start_y = top + rng.uniform(0.0, 0.10) * height
        angle = rng.uniform(0.9, 1.35)  # 下向き、やや左へ

        _line(
            big,
            start_x,
            start_y,
            start_x - length * np.cos(angle) * 1.4,
            start_y + length * np.sin(angle),
            width=rng.uniform(1.1, 1.9),
        )

        # 本番と同じ手順でそろえ直す(ここで本体が右へ押し込まれる)
        fixed = normalize_gray(big)
        out[i] = image if fixed is None else fixed
    return out
