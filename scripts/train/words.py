"""英単語を書いた線(試し場の「英単語」で送ったもの)から、1字ずつの見本を取り出す。

  python3 scripts/train/words.py            # 取り出して .cache/word_letters.json に書く
  python3 scripts/train/words.py --eval     # 今のモデルで、英単語がどれくらい自動でせいかいになるか測る

単語の中で書いた字は、1字だけで書いた字と形が変わる(o の閉じ方、i の点の位置、t の横棒の長さ)。
送ってもらった英単語には答えが付いているので、**答えに合わせて区切れば、ラベル付きの1字の見本**になる。
つづりを間違えた語や、区切りに失敗した語を混ぜると間違った字を覚えるので、
答えに合わせた区切りで、どの字もある程度(MIN_SCORE 以上)答えの字に見えた語だけを使う。

区切り方・描き直し方は src/features/recognize/word.ts と**同じ手順**で書いてある(ここが写し)。
どちらかを変えたら、もう一方も合わせること。--eval の数字が試し場と同じになるかで確かめられる。
"""

import base64
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

import emnist
from preprocess import normalize_gray

CACHE = os.path.join(os.path.dirname(__file__), ".cache")
WORDS = os.path.join(CACHE, "words.json")
OUT = os.path.join(CACHE, "word_letters.json")

# word.ts と同じ値
NEW_LINE_BACK = 0.5
NEW_LINE_DOWN = 0.8
NEW_LINE_BIG = 0.5
MAX_STROKES_PER_LETTER = 4
CELL = 120
LINE_WIDTH = 6
AUTO_MIN = 0.3

# 見本として使う語の条件: 答えに合わせて区切ったとき、いちばん低い字がこれ以上
MIN_SCORE = 0.05


def spans_of(strokes):
    """線を「上の行から、行の中は左端の順」に並べる(word.ts の spansOf)"""
    spans = []
    for stroke in strokes:
        if not stroke:
            continue
        xs = [p["x"] for p in stroke]
        ys = [p["y"] for p in stroke]
        spans.append({"stroke": stroke, "left": min(xs), "right": max(xs), "top": min(ys), "bottom": max(ys)})
    for span in spans:
        span["height"] = span["bottom"] - span["top"]
    heights = sorted(span["height"] for span in spans)
    height = heights[len(heights) // 2] if heights else 0

    line, right, centers = 0, float("-inf"), []
    for span in spans:
        center = (span["top"] + span["bottom"]) / 2
        big = span["height"] >= height * NEW_LINE_BIG
        middle = sum(centers) / len(centers) if centers else 0
        if big and centers and span["left"] < right - height * NEW_LINE_BACK and center > middle + height * NEW_LINE_DOWN:
            line, right, centers = line + 1, float("-inf"), []
        span["line"] = line
        right = max(right, span["right"])
        if big:
            centers.append(center)

    spans.sort(key=lambda span: (span["line"], span["left"]))
    return spans


def render(group):
    """1字ぶんの線を、マス1つ(CELL 角)に描き直す(word.ts の render)。線のあるところが 1"""
    points = [p for stroke in group for p in stroke]
    left = min(p["x"] for p in points)
    top = min(p["y"] for p in points)
    width = max(p["x"] for p in points) - left
    height = max(p["y"] for p in points) - top
    margin = LINE_WIDTH * 2
    scale = (CELL - margin * 2) / max(width, height, 1)
    offset_x = (CELL - width * scale) / 2
    offset_y = (CELL - height * scale) / 2

    ys, xs = np.mgrid[0:CELL, 0:CELL].astype(np.float32) + 0.5
    ink = np.zeros((CELL, CELL), dtype=bool)
    # ブラウザは線の縁をぼかして描き、前処理はその薄い縁まで線として拾うので、少し太く描くと揃う。
    # 0.4 足すと、--eval の数字が試し場(TS)と同じになった
    radius = LINE_WIDTH / 2 + 0.4
    for stroke in group:
        pts = [((p["x"] - left) * scale + offset_x, (p["y"] - top) * scale + offset_y) for p in stroke]
        if len(pts) == 1:
            pts = pts * 2
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            dx, dy = x1 - x0, y1 - y0
            length = dx * dx + dy * dy
            t = np.clip(((xs - x0) * dx + (ys - y0) * dy) / length, 0, 1) if length else 0
            ink |= (xs - (x0 + t * dx)) ** 2 + (ys - (y0 + t * dy)) ** 2 <= radius * radius
    return ink.astype(np.float32)


def probabilities(model, ink):
    pixels = normalize_gray(ink)
    if pixels is None:
        return np.zeros(len(emnist.LETTERS), dtype=np.float32)
    logits, _ = model.forward(pixels[None, None])
    exp = np.exp(logits[0] - logits[0].max())
    return exp / exp.sum()


def align(model, strokes, answer):
    """答えの文字数に合わせて、答えの各文字にいちばんよく見える区切り方を選ぶ(word.ts の alignToAnswer)"""
    spans = spans_of(strokes)
    units, letters = len(spans), len(answer)
    if units < letters:
        return None

    cache = {}

    def probs(start, end):
        if (start, end) not in cache:
            cache[(start, end)] = probabilities(model, render([s["stroke"] for s in spans[start:end]]))
        return cache[(start, end)]

    def score(start, end, letter):
        return np.log(max(float(probs(start, end)[emnist.LETTERS.index(letter)]), 1e-6))

    best = [[(float("-inf"), -1)] * (units + 1) for _ in range(letters + 1)]
    best[0][0] = (0.0, -1)
    for k in range(1, letters + 1):
        for i in range(k, units - (letters - k) + 1):
            for start in range(max(k - 1, i - MAX_STROKES_PER_LETTER), i):
                if best[k - 1][start][0] == float("-inf"):
                    continue
                if spans[start]["line"] != spans[i - 1]["line"]:
                    continue
                value = best[k - 1][start][0] + score(start, i, answer[k - 1])
                if value > best[k][i][0]:
                    best[k][i] = (value, start)
    if best[letters][units][0] == float("-inf"):
        return None

    cuts, i = [], units
    for k in range(letters, 0, -1):
        start = best[k][i][1]
        cuts.insert(0, (start, i))
        i = start
    return [
        {
            "letter": answer[index],
            "score": float(probs(start, end)[emnist.LETTERS.index(answer[index])]),
            "ink": render([s["stroke"] for s in spans[start:end]]),
        }
        for index, (start, end) in enumerate(cuts)
    ]


def pack(ink):
    """試し場の見本と同じ形(1bit を base64)に詰める"""
    bits = np.packbits(ink.reshape(-1) > 0)
    return base64.b64encode(bits.tobytes()).decode("ascii")


def load_words():
    with open(WORDS, encoding="utf-8") as handle:
        return json.load(handle)


def extract(model, attempts):
    """見本として使える語から、1字ずつの見本を取り出す"""
    samples, used = [], 0
    for attempt in attempts:
        found = align(model, attempt["strokes"], attempt["word"])
        if not found or min(entry["score"] for entry in found) < MIN_SCORE:
            continue
        used += 1
        for index, entry in enumerate(found):
            samples.append(
                {
                    "label": entry["letter"],
                    "size": CELL,
                    "ink": pack(entry["ink"]),
                    "at": f"{attempt['at']}#{index}",
                    "word": attempt["word"],
                }
            )
    return samples, used


def evaluate(model, attempts):
    """自動でせいかい(いちばん低い字が AUTO_MIN 以上)になった語の数を、文字数ごとに"""
    buckets = {}
    for attempt in attempts:
        n = len(attempt["word"])
        key = "4-5" if n <= 5 else "6-7" if n <= 7 else "8-10"
        found = align(model, attempt["strokes"], attempt["word"])
        auto = bool(found) and min(entry["score"] for entry in found) >= AUTO_MIN
        hit, total = buckets.get(key, (0, 0))
        buckets[key] = (hit + auto, total + 1)
    return buckets


def main():
    import finetune

    model = finetune.load_model(finetune.KINDS["letters"]["model"])
    attempts = load_words()
    if "--eval" in sys.argv:
        for key, (hit, total) in sorted(evaluate(model, attempts).items()):
            print(f"{key}文字: 自動(0.3) {hit}/{total}")
        return
    samples, used = extract(model, attempts)
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(samples, handle)
    print(f"{len(attempts)}語のうち {used}語から、1字の見本 {len(samples)}枚 → {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
