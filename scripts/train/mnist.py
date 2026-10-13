"""MNIST の取得と読み込み。

学習のたびに取りに行かないよう、.cache/ に置いて使い回す
(辞書データの取得スクリプトと同じ考え方)。
"""

import gzip
import os
import urllib.request

import numpy as np

BASE = "https://storage.googleapis.com/cvdf-datasets/mnist/"
CACHE = os.path.join(os.path.dirname(__file__), ".cache")

FILES = {
    "train_x": "train-images-idx3-ubyte.gz",
    "train_y": "train-labels-idx1-ubyte.gz",
    "test_x": "t10k-images-idx3-ubyte.gz",
    "test_y": "t10k-labels-idx1-ubyte.gz",
}


def _fetch(name: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print(f"  取得: {name}")
        urllib.request.urlretrieve(BASE + name, path)
    return path


def _read_idx(path: str) -> np.ndarray:
    with gzip.open(path, "rb") as handle:
        data = handle.read()
    kind = int.from_bytes(data[2:3], "big")
    assert kind == 0x08, "符号なし1バイトの形式だけを読む"
    dims = int.from_bytes(data[3:4], "big")
    shape = [int.from_bytes(data[4 + i * 4 : 8 + i * 4], "big") for i in range(dims)]
    return np.frombuffer(data, dtype=np.uint8, offset=4 + dims * 4).reshape(shape)


def load():
    """(学習画像, 学習ラベル, 試験画像, 試験ラベル)。画像は 0〜1 の float32"""
    print("MNIST")
    out = {key: _read_idx(_fetch(name)) for key, name in FILES.items()}
    return (
        out["train_x"].astype(np.float32) / 255.0,
        out["train_y"].astype(np.int64),
        out["test_x"].astype(np.float32) / 255.0,
        out["test_y"].astype(np.int64),
    )
