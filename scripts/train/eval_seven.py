"""いまのモデルが、日本式の 7(チョン付き・離れ)をどれだけ読めるか測る"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

import mnist
from net import Net
from style_seven import add_tick

MODEL = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "model.digits.generated.json")


def load_model():
    with open(MODEL, encoding="utf-8") as handle:
        payload = json.load(handle)
    model = Net(np.random.default_rng(0))
    for layer in payload["layers"]:
        values = np.array(layer["values"], dtype=np.float32) * layer["scale"]
        setattr(model, layer["name"], values.reshape(layer["shape"]))
    return model


def main():
    _, _, test_x, test_y = mnist.load()
    model = load_model()
    rng = np.random.default_rng(99)
    sevens = test_x[test_y == 7]

    for name, images in [
        ("そのままの 7", sevens),
        ("チョン付き(つながっている)", add_tick(sevens, rng, detach_rate=0.0)),
        ("チョン付き(離れている)", add_tick(sevens, rng, detach_rate=1.0)),
    ]:
        logits, _ = model.forward(images[:, None])
        exp = np.exp(logits - logits.max(axis=1, keepdims=True))
        prob = exp / exp.sum(axis=1, keepdims=True)
        top = prob.argmax(axis=1)
        hit = (top == 7).mean()
        wrong = np.bincount(top[top != 7], minlength=10)
        print(f"{name:26} 正解 {hit * 100:5.1f}%  平均の確からしさ {prob[:, 7].mean():.2f}  "
              f"まちがえた先 {[(i, int(c)) for i, c in enumerate(wrong) if c]}")


if __name__ == "__main__":
    main()
