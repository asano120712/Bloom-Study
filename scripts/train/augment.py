"""指で書いた字に寄せる水増し。

MNIST は紙にペンで書いた字で、**指で画面に書いた字とは違う**。
- 線が細く、かすれる(速く動かすため)
- 大きく傾く、はみ出す
- 画数の切れ目が離れる

学習画像にこれらを混ぜておくと、本番の字でも外しにくくなる。
回転・拡大・移動は、画素を数える素朴な方法で行う(numpy だけで足りる)。
"""

import numpy as np


def _affine(images, matrices):
    """画像ごとに別の 2×3 行列をかける。出力の各画素に対して、元の位置を引く"""
    n, h, w = images.shape
    ys, xs = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    # 中心まわりで変換する
    cx, cy = (w - 1) / 2, (h - 1) / 2
    px = xs[None] - cx
    py = ys[None] - cy

    src_x = matrices[:, 0, 0, None, None] * px + matrices[:, 0, 1, None, None] * py + matrices[:, 0, 2, None, None] + cx
    src_y = matrices[:, 1, 0, None, None] * px + matrices[:, 1, 1, None, None] * py + matrices[:, 1, 2, None, None] + cy

    x0 = np.clip(np.round(src_x).astype(np.int32), 0, w - 1)
    y0 = np.clip(np.round(src_y).astype(np.int32), 0, h - 1)
    inside = (src_x >= -0.5) & (src_x <= w - 0.5) & (src_y >= -0.5) & (src_y <= h - 0.5)
    out = images[np.arange(n)[:, None, None], y0, x0]
    return np.where(inside, out, 0).astype(np.float32)


def _thin_or_thicken(images, rng):
    """線を細く / 太くする。3×3 の最小値・最大値で代用する"""
    n = images.shape[0]
    pick = rng.random(n)
    padded = np.pad(images, ((0, 0), (1, 1), (1, 1)))
    stack = np.stack(
        [padded[:, i : i + images.shape[1], j : j + images.shape[2]] for i in range(3) for j in range(3)],
        axis=0,
    )
    thin = stack.min(axis=0)
    thick = stack.max(axis=0)
    out = images.copy()
    out[pick < 0.3] = thin[pick < 0.3]
    out[pick > 0.8] = thick[pick > 0.8]
    return out


def augment(images, rng):
    """(N, 28, 28) を同じ形のまま崩す"""
    n = images.shape[0]
    angle = rng.uniform(-0.22, 0.22, n)          # ±12度ほど
    scale = rng.uniform(0.85, 1.15, n)
    shift_x = rng.uniform(-2.0, 2.0, n)
    shift_y = rng.uniform(-2.0, 2.0, n)
    shear = rng.uniform(-0.15, 0.15, n)

    cos, sin = np.cos(angle) / scale, np.sin(angle) / scale
    matrices = np.zeros((n, 2, 3), dtype=np.float32)
    matrices[:, 0, 0] = cos
    matrices[:, 0, 1] = sin + shear
    matrices[:, 0, 2] = shift_x
    matrices[:, 1, 0] = -sin
    matrices[:, 1, 1] = cos
    matrices[:, 1, 2] = shift_y

    return _thin_or_thicken(_affine(images, matrices), rng)
