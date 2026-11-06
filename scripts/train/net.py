"""小さな畳み込みニューラルネット(numpy だけ)。

TypeScript 側(src/features/recognize/net.ts)で同じ計算を再現するので、
**層の種類と順番は増やさない**。conv / relu / maxpool / dense / softmax だけ。

  28×28 → conv(f1, 3×3) → relu → maxpool2 → conv(f2, 3×3) → relu → maxpool2 → dense(classes)

数字は f1=8, f2=16, classes=10(重み約5,200個。int8 に落として 10KB ほど)。
英字は種類が多く形も似ているので、フィルターを増やして使う(train_letters.py)。
TS 側はフィルターの数を重みの形から読むので、ここを変えても合わせ直さなくてよい。
"""

import numpy as np


def pool2(a):
    """2×2 の最大値。奇数のときは**右端・下端を捨てる**(TS 側も同じにすること)"""
    n, c, h, w = a.shape
    h2, w2 = h - h % 2, w - w % 2
    cropped = a[:, :, :h2, :w2]
    return cropped.reshape(n, c, h2 // 2, 2, w2 // 2, 2).max(axis=(3, 5))


def im2col(x, k):
    """(N, C, H, W) を (N, C*k*k, 出力マス数) へ。畳み込みを行列積1回で済ませる"""
    n, c, h, w = x.shape
    oh, ow = h - k + 1, w - k + 1
    cols = np.empty((n, c, k, k, oh, ow), dtype=x.dtype)
    for i in range(k):
        for j in range(k):
            cols[:, :, i, j] = x[:, :, i : i + oh, j : j + ow]
    return cols.reshape(n, c * k * k, oh * ow), oh, ow


class Net:
    def __init__(self, rng, classes=10, f1=8, f2=16):
        self.f1, self.f2 = f1, f2

        def he(shape, fan_in):
            return (rng.standard_normal(shape) * np.sqrt(2.0 / fan_in)).astype(np.float32)

        self.w1 = he((f1, 1, 3, 3), 9)
        self.b1 = np.zeros(f1, dtype=np.float32)
        self.w2 = he((f2, f1, 3, 3), f1 * 9)
        self.b2 = np.zeros(f2, dtype=np.float32)
        self.w3 = he((classes, f2 * 5 * 5), f2 * 5 * 5)
        self.b3 = np.zeros(classes, dtype=np.float32)

    def forward(self, x, keep=False):
        n = x.shape[0]
        cache = {}

        c1, oh1, ow1 = im2col(x, 3)
        z1 = (self.w1.reshape(self.f1, -1) @ c1).reshape(n, self.f1, oh1, ow1) + self.b1[None, :, None, None]
        a1 = np.maximum(z1, 0)
        p1 = pool2(a1)

        c2, oh2, ow2 = im2col(p1, 3)
        z2 = (self.w2.reshape(self.f2, -1) @ c2).reshape(n, self.f2, oh2, ow2) + self.b2[None, :, None, None]
        a2 = np.maximum(z2, 0)
        p2 = pool2(a2)

        flat = p2.reshape(n, -1)
        logits = flat @ self.w3.T + self.b3

        if keep:
            cache.update(
                x=x, c1=c1, z1=z1, a1=a1, p1=p1, c2=c2, z2=z2, a2=a2, p2=p2, flat=flat,
                oh1=oh1, ow1=ow1, oh2=oh2, ow2=ow2,
            )
        return logits, cache

    def loss_and_grads(self, x, y):
        n = x.shape[0]
        logits, cache = self.forward(x, keep=True)

        shifted = logits - logits.max(axis=1, keepdims=True)
        exp = np.exp(shifted)
        prob = exp / exp.sum(axis=1, keepdims=True)
        loss = -np.log(prob[np.arange(n), y] + 1e-9).mean()

        d_logits = prob
        d_logits[np.arange(n), y] -= 1
        d_logits /= n

        g = {}
        g["w3"] = d_logits.T @ cache["flat"]
        g["b3"] = d_logits.sum(axis=0)

        d_flat = d_logits @ self.w3
        d_p2 = d_flat.reshape(cache["p2"].shape)

        def unpool(d_pool, a, ch):
            n_, _, h, w = a.shape
            h2, w2 = h - h % 2, w - w % 2
            blocks = a[:, :, :h2, :w2].reshape(n_, ch, h2 // 2, 2, w2 // 2, 2)
            mask = blocks == blocks.max(axis=(3, 5), keepdims=True)
            # 同点が複数あるときは分け合う(逆伝播の総量を変えない)
            mask = mask / mask.sum(axis=(3, 5), keepdims=True)
            spread = (mask * d_pool[:, :, :, None, :, None]).reshape(n_, ch, h2, w2)
            out = np.zeros_like(a)
            out[:, :, :h2, :w2] = spread
            return out

        d_a2 = unpool(d_p2, cache["a2"], self.f2)
        d_z2 = d_a2 * (cache["z2"] > 0)
        n2 = d_z2.reshape(d_z2.shape[0], self.f2, -1)
        g["w2"] = np.einsum("nfo,nko->fk", n2, cache["c2"]).reshape(self.w2.shape)
        g["b2"] = n2.sum(axis=(0, 2))

        d_c2 = np.einsum("fk,nfo->nko", self.w2.reshape(self.f2, -1), n2)
        d_p1 = col2im(d_c2, cache["p1"].shape, 3, cache["oh2"], cache["ow2"])

        d_a1 = unpool(d_p1, cache["a1"], self.f1)
        d_z1 = d_a1 * (cache["z1"] > 0)
        n1 = d_z1.reshape(d_z1.shape[0], self.f1, -1)
        g["w1"] = np.einsum("nfo,nko->fk", n1, cache["c1"]).reshape(self.w1.shape)
        g["b1"] = n1.sum(axis=(0, 2))

        return loss, g, prob


def col2im(cols, shape, k, oh, ow):
    """im2col の逆。重なるところは足し合わせる"""
    n, c, h, w = shape
    out = np.zeros(shape, dtype=np.float32)
    cols = cols.reshape(n, c, k, k, oh, ow)
    for i in range(k):
        for j in range(k):
            out[:, :, i : i + oh, j : j + ow] += cols[:, :, i, j]
    return out
