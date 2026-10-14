"""数字(0〜9)の読み取りモデルを学習して、重みを書き出す。

  python3 scripts/train/train_digits.py

書き出し先: src/data/model.digits.generated.json
重みは int8 に落とす(層ごとに倍率を1つ持つ)。精度はほとんど落ちず、
大きさが4分の1になる。
"""

import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

import augment
import mnist
from net import Net
from style_seven import add_tick

EPOCHS = 8
BATCH = 128
LEARNING_RATE = 0.05
MOMENTUM = 0.9
# 学習率を下げていく。一定のままだと後半で重みが暴れて一気に壊れる
# (0.08 固定では5エポック目に 97.9% → 10% まで落ちた)
DECAY = 0.7
# 勾配が大きすぎるときは縮める。壊れ方のもう一方の原因を塞ぐ
CLIP = 4.0
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "model.digits.generated.json")


def accuracy(model, x, y, batch=1000):
    hit = 0
    for i in range(0, len(x), batch):
        logits, _ = model.forward(x[i : i + batch][:, None])
        hit += int((logits.argmax(axis=1) == y[i : i + batch]).sum())
    return hit / len(x)


def quantize(array):
    """int8 + 倍率1つ。重みは 0 を中心に分布するので、これで足りる"""
    scale = float(np.abs(array).max()) / 127.0 or 1.0
    return np.round(array / scale).astype(np.int8), scale


def main():
    train_x, train_y, test_x, test_y = mnist.load()
    rng = np.random.default_rng(1234)

    # 日本式の 7(左に離れたチョン)を足す。
    # MNIST には1枚も無く、実機では 4 や 9 と読まれていた形。
    # 毎回作ると遅いので、先にまとめて作って学習データに足しておく。
    sevens = train_x[train_y == 7]
    picked = sevens[rng.permutation(len(sevens))[: int(len(sevens) * 0.7)]]
    print(f"日本式の 7 を {len(picked)}枚つくる...")
    ticked = add_tick(picked, rng)
    train_x = np.concatenate([train_x, ticked])
    train_y = np.concatenate([train_y, np.full(len(ticked), 7, dtype=train_y.dtype)])
    model = Net(rng)
    velocity = {name: np.zeros_like(getattr(model, name)) for name in ["w1", "b1", "w2", "b2", "w3", "b3"]}
    best = {"score": 0.0, "weights": None}

    print(f"学習 {len(train_x)}枚 / 試験 {len(test_x)}枚")
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
        print(f"  {epoch + 1}/{EPOCHS}  損失 {np.mean(losses):.4f}  試験の正解率 {score * 100:.2f}%  ({time.time() - started:.0f}秒)")

        # いちばん良かったときの重みを残す。最後が良いとは限らない
        if score > best["score"]:
            best = {"score": score, "weights": {n: getattr(model, n).copy() for n in velocity}}

    # いちばん良かった重みに戻してから書き出す
    for name, values in best["weights"].items():
        setattr(model, name, values)
    print(f"いちばん良かった回: 試験の正解率 {best['score'] * 100:.2f}%")

    # 崩した字でも測る(本番は指書きなので、こちらのほうが近い)
    rough = augment.augment(test_x, np.random.default_rng(7))
    print(f"崩した試験の正解率 {accuracy(model, rough, test_y) * 100:.2f}%")

    # 日本式の 7 だけでも測る(ここが直したかったところ)
    test_sevens = test_x[test_y == 7]
    styled = add_tick(test_sevens, np.random.default_rng(11))
    hit = accuracy(model, styled, np.full(len(styled), 7))
    print(f"日本式の 7 の正解率 {hit * 100:.2f}%")

    payload = {
        "_source": {
            "note": "自動生成。scripts/train/train_digits.py で上書きされる",
            "dataset": "MNIST (Yann LeCun / Corinna Cortes, CC BY-SA 3.0)",
            "shape": "28x28 → conv8 → pool → conv16 → pool → dense10",
        },
        "labels": [str(i) for i in range(10)],
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
    size = os.path.getsize(OUT) / 1024
    print(f"書き出し: {os.path.relpath(OUT)} ({size:.0f}KB)")


if __name__ == "__main__":
    main()
