"""書き出した自分の字(samples.json)で、いまのモデルを測る。

  python3 scripts/train/eval_samples.py ~/Downloads/samples.json

試し場(/dev/recognize)の「書き出す」で作ったファイルを読む。
前処理はブラウザ側と同じ手順(囲みを切る → 20×20 に収める → 重心を中央へ)。
"""

import base64
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from eval_seven import load_model
from preprocess import normalize_gray, unpack

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Downloads/samples.json")
    with open(path, encoding="utf-8") as handle:
        samples = json.load(handle)

    model = load_model()
    print(f"{len(samples)}枚 / {os.path.basename(path)}")

    hit = 0
    for sample in samples:
        pixels = normalize_gray(unpack(sample))
        if pixels is None:
            print(f"  {sample['label']}: 線が見つからない")
            continue
        logits, _ = model.forward(pixels[None, None])
        exp = np.exp(logits - logits.max())
        prob = (exp / exp.sum())[0]
        top = int(prob.argmax())
        label = sample["label"]
        ok = str(top) == label
        hit += ok
        order = " ".join(f"{i}:{prob[i]:.2f}" for i in np.argsort(-prob)[:3])
        print(f"  {'○' if ok else '×'} 書いたのは {label} → {order}")
        if not ok:
            # 外した字は目で見る
            for row in pixels[::2]:
                print("    " + "".join("#" if v > 0.5 else ("+" if v > 0.15 else ".") for v in row))

    print(f"\n正解 {hit} / {len(samples)}")


if __name__ == "__main__":
    main()
