"""英字(小文字 a〜z)の読み取りモデルを学習して、重みを書き出す。

  python3 scripts/train/train_letters.py

書き出し先: src/data/model.letters.generated.json
材料は EMNIST の小文字(emnist.py)。数字(train_digits.py)と同じ作りで、
種類が多く形も似ている(a と d、h と n)ぶん、フィルターを増やしてある。

試し場から送った自分の字(.cache/samples.json)があれば、毎回それでも測る。
EMNIST の試験の正解率より、こちらのほうが本番(指で画面に書いた字)に近い。
"""

import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

import augment
import emnist
from net import Net
from preprocess import normalize_gray, unpack
from train_digits import BATCH, CLIP, MOMENTUM, accuracy, quantize

EPOCHS = 10
LEARNING_RATE = 0.03
DECAY = 0.75
F1, F2 = 16, 32
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "model.letters.generated.json")
SAMPLES = os.path.join(os.path.dirname(__file__), ".cache", "samples.json")


def real_samples():
    """試し場から送った字のうち、英字だけ。本番に近い物差しとして使う"""
    if not os.path.exists(SAMPLES):
        return None, None
    with open(SAMPLES, encoding="utf-8") as handle:
        samples = [s for s in json.load(handle) if s["label"] in emnist.LETTERS]
    xs, ys = [], []
    for sample in samples:
        normalized = normalize_gray(unpack(sample))
        if normalized is not None:
            xs.append(normalized)
            ys.append(emnist.LETTERS.index(sample["label"]))
    if not xs:
        return None, None
    return np.stack(xs), np.array(ys)


def main():
    train_x, train_y, test_x, test_y = emnist.load()
    real_x, real_y = real_samples()
    rng = np.random.default_rng(1234)

    model = Net(rng, classes=len(emnist.LETTERS), f1=F1, f2=F2)
    velocity = {name: np.zeros_like(getattr(model, name)) for name in ["w1", "b1", "w2", "b2", "w3", "b3"]}
    best = {"score": 0.0, "weights": None}

    print(f"学習 {len(train_x)}枚 / 試験 {len(test_x)}枚 / 自分の字 {0 if real_x is None else len(real_x)}枚")
    for epoch in range(EPOCHS):
        started = time.time()
        order = rng.permutation(len(train_x))
        rate = LEARNING_RATE * (DECAY**epoch)
        losses = []
        for step in range(0, len(order), BATCH):
            picked = order[step : step + BATCH]
            batch = augment.augment(train_x[picked], rng)[:, None]
            loss, grads, _ = model.loss_and_grads(batch, train_y[picked])
            losses.append(loss)

            norm = np.sqrt(sum(float((grads[name] ** 2).sum()) for name in velocity))
            factor = min(1.0, CLIP / (norm + 1e-9))
            for name in velocity:
                velocity[name] = MOMENTUM * velocity[name] - rate * factor * grads[name]
                setattr(model, name, getattr(model, name) + velocity[name])

        score = accuracy(model, test_x, test_y)
        real = "" if real_x is None else f"  自分の字 {accuracy(model, real_x, real_y) * 100:.0f}%"
        print(f"  {epoch + 1}/{EPOCHS}  損失 {np.mean(losses):.4f}  試験の正解率 {score * 100:.2f}%{real}  ({time.time() - started:.0f}秒)")

        if score > best["score"]:
            best = {"score": score, "weights": {n: getattr(model, n).copy() for n in velocity}}

    for name, values in best["weights"].items():
        setattr(model, name, values)
    print(f"いちばん良かった回: 試験の正解率 {best['score'] * 100:.2f}%")
    rough = augment.augment(test_x, np.random.default_rng(7))
    print(f"崩した試験の正解率 {accuracy(model, rough, test_y) * 100:.2f}%")
    if real_x is not None:
        logits, _ = model.forward(real_x[:, None])
        guessed = logits.argmax(axis=1)
        print(f"自分の字の正解率 {(guessed == real_y).mean() * 100:.0f}% ({int((guessed == real_y).sum())}/{len(real_y)})")
        for truth, guess in zip(real_y, guessed):
            if truth != guess:
                print(f"    {emnist.LETTERS[truth]} → {emnist.LETTERS[guess]}")

    payload = {
        "_source": {
            "note": "自動生成。scripts/train/train_letters.py で上書きされる",
            "dataset": "EMNIST byclass の小文字 (Cohen et al. 2017, NIST)",
            "shape": f"28x28 → conv{F1} → pool → conv{F2} → pool → dense{len(emnist.LETTERS)}",
        },
        "labels": list(emnist.LETTERS),
        "layers": [],
    }
    for name in ["w1", "b1", "w2", "b2", "w3", "b3"]:
        array = getattr(model, name)
        values, scale = quantize(array)
        payload["layers"].append(
            {"name": name, "shape": list(array.shape), "scale": scale, "values": values.reshape(-1).tolist()}
        )

    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
    print(f"書き出し: {os.path.relpath(OUT)} ({os.path.getsize(OUT) / 1024:.0f}KB)")


if __name__ == "__main__":
    main()
