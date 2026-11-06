# 学習まわり(開発時だけ)

手書きの読み取りに使う重みを作る。**できあがった重みだけ**を
`src/data/model.*.generated.json` に置き、アプリは TypeScript 側で読むだけ。
ここのスクリプトはビルドにもアプリにも含まれない。

```
python3 -m pip install --user numpy      # 1度だけ。torch は使わない
python3 scripts/train/train_digits.py    # MNIST を取得して学習 → 重みを書き出す
python3 scripts/train/train_letters.py   # 英字(小文字)。先に EMNIST を .cache/emnist/gzip.zip に置く(emnist.py を参照)
node scripts/check-recognizer.ts         # TS 側の推論が Python と同じ答えを出すか
```

## なぜ学習するのか

最初は学習なし(文字を描いたお手本と重ねる方式)で試した。合成したきれいな線なら
30/30 当たるが、**実際の指書きでは 4↔9、7↔1、b↔k、g↔q が入れ替わり**、
1位と2位の距離差も 0.2 以内で、順位がほぼ偶然になった。
1 のひげ・7 の横棒・4 の開きのような手書き特有の形は、フォントの字形には無いため。

MNIST は手書き数字そのものなので、ここが埋まる。
