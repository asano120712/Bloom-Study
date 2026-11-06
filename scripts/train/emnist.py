"""EMNIST(手書きの英字)の取得と読み込み。

  公式: https://www.nist.gov/itl/products-and-services/emnist-dataset
  ファイル: https://biometrics.nist.gov/cs_links/EMNIST/gzip.zip (約560MB。.cache/emnist/ に置く)

使うのは byclass(数字・大文字・小文字を分けたもの)の**小文字 26 種類だけ**。
letters(大文字と小文字を1つにまとめたもの)は、出題の答えが小文字なのに、
B や D のような大文字の形まで「b」「d」として覚えてしまうので使わない。

EMNIST の画像は縦横が入れ替わって入っている(転置して戻す)。
また字の収め方が MNIST と違う(枠いっぱい)ので、**本番と同じそろえ方で揃え直す**
(preprocess.normalize_gray)。ここがずれると、本番の字で精度が落ちる。
揃え直しは遅いので、一度やったら .cache/emnist/letters.npz に置いて使い回す。
"""

import gzip
import os
import time
import zipfile

import numpy as np

from preprocess import normalize_gray

CACHE = os.path.join(os.path.dirname(__file__), ".cache", "emnist")
ARCHIVE = os.path.join(CACHE, "gzip.zip")
PREPARED = os.path.join(CACHE, "letters.npz")

LETTERS = "abcdefghijklmnopqrstuvwxyz"
# byclass のラベル: 0〜9 が数字、10〜35 が大文字、36〜61 が小文字
LOWER_START = 36
# 1字あたりの上限。多い字(e, a など)に引っぱられないよう、そろえて間引く
PER_LETTER_TRAIN = 4000
PER_LETTER_TEST = 400


def _read_idx(archive, name):
    with archive.open(f"gzip/{name}") as raw, gzip.open(raw) as handle:
        data = handle.read()
    dims = data[3]
    shape = [int.from_bytes(data[4 + i * 4 : 8 + i * 4], "big") for i in range(dims)]
    return np.frombuffer(data, dtype=np.uint8, offset=4 + dims * 4).reshape(shape)


def _pick(images, labels, per_letter, rng):
    xs, ys = [], []
    for index in range(len(LETTERS)):
        found = np.where(labels == LOWER_START + index)[0]
        chosen = found[rng.permutation(len(found))[:per_letter]]
        xs.append(images[chosen])
        ys.append(np.full(len(chosen), index, dtype=np.int64))
    return np.concatenate(xs), np.concatenate(ys)


def _normalize_all(images):
    """転置して戻し、本番と同じ手順で 28×28 に揃え直す。字の無い画像は捨てる"""
    out, keep = [], []
    for index, image in enumerate(images):
        # 濃淡のまま。線とみなす濃さは preprocess と同じ基準で切る
        normalized = normalize_gray((image.T.astype(np.float32) / 255.0 >= 0.5).astype(np.float32))
        if normalized is None:
            continue
        out.append(normalized)
        keep.append(index)
    return np.stack(out), np.array(keep)


def load():
    """(学習画像, 学習ラベル, 試験画像, 試験ラベル)。画像は (N, 28, 28) の 0〜1"""
    if os.path.exists(PREPARED):
        data = np.load(PREPARED)
        return data["train_x"], data["train_y"], data["test_x"], data["test_y"]

    if not os.path.exists(ARCHIVE):
        raise SystemExit(f"EMNIST がありません。{ARCHIVE} に gzip.zip を置いてください(上の説明を参照)")

    print("EMNIST byclass から小文字を取り出す...")
    rng = np.random.default_rng(42)
    with zipfile.ZipFile(ARCHIVE) as archive:
        train_x, train_y = _pick(
            _read_idx(archive, "emnist-byclass-train-images-idx3-ubyte.gz"),
            _read_idx(archive, "emnist-byclass-train-labels-idx1-ubyte.gz"),
            PER_LETTER_TRAIN,
            rng,
        )
        test_x, test_y = _pick(
            _read_idx(archive, "emnist-byclass-test-images-idx3-ubyte.gz"),
            _read_idx(archive, "emnist-byclass-test-labels-idx1-ubyte.gz"),
            PER_LETTER_TEST,
            rng,
        )

    started = time.time()
    print(f"本番と同じそろえ方に直す({len(train_x) + len(test_x)}枚。数分かかる)...")
    train_x, kept = _normalize_all(train_x)
    train_y = train_y[kept]
    test_x, kept = _normalize_all(test_x)
    test_y = test_y[kept]
    print(f"  {time.time() - started:.0f}秒")

    np.savez_compressed(PREPARED, train_x=train_x, train_y=train_y, test_x=test_x, test_y=test_y)
    return train_x, train_y, test_x, test_y
