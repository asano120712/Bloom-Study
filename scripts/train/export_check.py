"""TS 側の推論を確かめるための材料を書き出す。

Python と TypeScript で**同じ答えになるか**を見るためのもの。
重みを写し間違えたり、プーリングの端の扱いがずれていると、ここで分かる。
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

import mnist
from net import Net

OUT = os.path.join(os.path.dirname(__file__), ".cache", "check.json")
MODEL = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "model.digits.generated.json")


def main():
    with open(MODEL, encoding="utf-8") as handle:
        payload = json.load(handle)

    model = Net(np.random.default_rng(0))
    for layer in payload["layers"]:
        values = np.array(layer["values"], dtype=np.float32) * layer["scale"]
        setattr(model, layer["name"], values.reshape(layer["shape"]))

    _, _, test_x, test_y = mnist.load()
    picked = test_x[:50]
    logits, _ = model.forward(picked[:, None])
    exp = np.exp(logits - logits.max(axis=1, keepdims=True))
    prob = exp / exp.sum(axis=1, keepdims=True)

    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "pixels": picked.reshape(len(picked), -1).round(6).tolist(),
                "labels": test_y[:50].tolist(),
                "prob": prob.round(6).tolist(),
            },
            handle,
        )
    print(f"書き出し: {os.path.relpath(OUT)}  ({len(picked)}枚)")
    print("Python 側の正解率:", float((prob.argmax(axis=1) == test_y[:50]).mean()))


if __name__ == "__main__":
    main()
