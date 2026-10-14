"""集めた見本を混ぜて、モデルを仕上げ直す。

  python3 scripts/train/finetune.py             # 見本を全部混ぜて仕上げ、書き出す
  python3 scripts/train/finetune.py --holdout   # 半分を伏せて、効くかどうかを測る
  python3 scripts/train/finetune.py --loo       # 1枚ずつ伏せる(枚数が少ないとき)

合成した水増し(scripts/train/style_seven.py)では、実機で書いた7に届かなかった。
**実物を混ぜる**のがいちばん近道だが、枚数が少ないので、
効くかどうかを先に「1枚伏せ(leave-one-out)」で確かめられるようにしてある。
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

import augment
import mnist
from net import Net
from preprocess import normalize_gray, unpack

MODEL = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "model.digits.generated.json")
SAMPLES = os.path.join(os.path.dirname(__file__), ".cache", "samples.json")

STEPS = 400
BATCH = 128
# 1回ぶんのうち、集めた見本を入れる割合。入れすぎると MNIST のぶんを忘れる
SAMPLE_SHARE = 0.25
LEARNING_RATE = 0.01
MOMENTUM = 0.9


def load_model(path=MODEL):
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    model = Net(np.random.default_rng(0))
    for layer in payload["layers"]:
        values = np.array(layer["values"], dtype=np.float32) * layer["scale"]
        setattr(model, layer["name"], values.reshape(layer["shape"]))
    return model


def load_samples():
    with open(SAMPLES, encoding="utf-8") as handle:
        raw = json.load(handle)
    images, labels = [], []
    for sample in raw:
        pixels = normalize_gray(unpack(sample))
        if pixels is None:
            continue
        images.append(pixels)
        labels.append(int(sample["label"]))
    return np.array(images, dtype=np.float32), np.array(labels, dtype=np.int64)


def finetune(model, train_x, train_y, sample_x, sample_y, rng, steps=STEPS):
    velocity = {name: np.zeros_like(getattr(model, name)) for name in ["w1", "b1", "w2", "b2", "w3", "b3"]}
    picked_count = int(BATCH * SAMPLE_SHARE)

    for _ in range(steps):
        base = rng.integers(0, len(train_x), BATCH - picked_count)
        mine = rng.integers(0, len(sample_x), picked_count)
        batch = np.concatenate([train_x[base], sample_x[mine]])
        labels = np.concatenate([train_y[base], sample_y[mine]])
        batch = augment.augment(batch, rng)[:, None]

        _, grads, _ = model.loss_and_grads(batch, labels)
        norm = np.sqrt(sum(float((grads[n] ** 2).sum()) for n in velocity))
        factor = min(1.0, 4.0 / (norm + 1e-9))
        for name in velocity:
            velocity[name] = MOMENTUM * velocity[name] - LEARNING_RATE * factor * grads[name]
            setattr(model, name, getattr(model, name) + velocity[name])
    return model


def predict(model, images):
    logits, _ = model.forward(images[:, None])
    exp = np.exp(logits - logits.max(axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)


def quantize(array):
    scale = float(np.abs(array).max()) / 127.0 or 1.0
    return np.round(array / scale).astype(np.int8), scale


def export(model, labels):
    """重みを書き出す。学習の本体(train_digits.py)と同じ形"""
    payload = {
        "_source": {
            "note": "自動生成。scripts/train/finetune.py で上書きされる",
            "dataset": "MNIST + 実機で集めた見本(scripts/train/.cache/samples.json)",
            "shape": "28x28 → conv8 → pool → conv16 → pool → dense10",
        },
        "labels": labels,
        "layers": [],
    }
    for name in ["w1", "b1", "w2", "b2", "w3", "b3"]:
        array = getattr(model, name)
        values, scale = quantize(array)
        payload["layers"].append(
            {"name": name, "shape": list(array.shape), "scale": scale, "values": values.reshape(-1).tolist()}
        )
    with open(MODEL, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
    print(f"書き出し: {os.path.relpath(MODEL)}")


def main():
    train_x, train_y, test_x, test_y = mnist.load()
    sample_x, sample_y = load_samples()
    print(f"集めた見本 {len(sample_x)}枚")

    if "--holdout" in sys.argv:
        # 半分で仕上げて、残り半分で測る。入れ替えて2回やる
        rng = np.random.default_rng(5)
        order = rng.permutation(len(sample_x))
        folds = [order[: len(order) // 2], order[len(order) // 2 :]]
        hit = total = 0
        for turn, held in enumerate(folds):
            used = np.setdiff1d(order, held)
            model = finetune(load_model(), train_x, train_y, sample_x[used], sample_y[used], np.random.default_rng(turn))
            prob = predict(model, sample_x[held])
            top = prob.argmax(axis=1)
            for i, index in enumerate(held):
                mark = "○" if top[i] == sample_y[index] else "×"
                if top[i] != sample_y[index]:
                    order_text = " ".join(f"{j}:{prob[i][j]:.2f}" for j in np.argsort(-prob[i])[:3])
                    print(f"  × 伏せた{sample_y[index]} → {order_text}")
                hit += int(top[i] == sample_y[index])
            total += len(held)
            print(f"  {turn + 1}回め: {int((top == sample_y[held]).sum())} / {len(held)}  "
                  f"(MNIST {float((predict(model, test_x[:2000]).argmax(axis=1) == test_y[:2000]).mean()) * 100:.1f}%)")
        print(f"\n伏せたぶんの正解 {hit} / {total}")
        return

    if "--loo" in sys.argv:
        # 1枚ずつ伏せて仕上げ、その1枚で測る。混ぜる意味があるかを見るため
        hit = 0
        for i in range(len(sample_x)):
            keep = np.arange(len(sample_x)) != i
            model = finetune(
                load_model(), train_x, train_y, sample_x[keep], sample_y[keep], np.random.default_rng(100 + i)
            )
            prob = predict(model, sample_x[i : i + 1])[0]
            top = int(prob.argmax())
            hit += top == sample_y[i]
            order = " ".join(f"{j}:{prob[j]:.2f}" for j in np.argsort(-prob)[:3])
            print(f"  {'○' if top == sample_y[i] else '×'} 伏せた1枚({sample_y[i]}) → {order}")
        print(f"\n1枚伏せでの正解 {hit} / {len(sample_x)}")
        return

    model = finetune(load_model(), train_x, train_y, sample_x, sample_y, np.random.default_rng(7))
    print(f"MNIST の試験: {float((predict(model, test_x).argmax(axis=1) == test_y).mean()) * 100:.2f}%")
    print(f"集めた見本:   {float((predict(model, sample_x).argmax(axis=1) == sample_y).mean()) * 100:.2f}%")
    export(model, [str(i) for i in range(10)])


if __name__ == "__main__":
    main()
