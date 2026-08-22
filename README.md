# Bloomstudy

ヒントが花びらのようにひとつずつ浮かびあがるあいだに、答えを「思い出す」ゲーム型の学習ウェブアプリ。

- [要件定義書](Bloomstudy_要件定義書.md) — コンセプト・ビジネスモデル
- [機能要件書](Bloomstudy_機能要件書.md) — 画面一覧・機能要件
- [技術選定書](Bloomstudy_技術選定書.md) — 技術スタックと選定理由

## 開発環境

| 項目 | 内容 |
|---|---|
| 言語 | TypeScript |
| フレームワーク | React 19 |
| ビルドツール | Vite |
| スタイリング | Tailwind CSS v4(`@tailwindcss/vite` プラグイン) |
| ルーティング | React Router |
| 判定(レベル2) | `fast-levenshtein` |
| Lint | oxlint |

必要なもの: Node.js 20 以上(開発は v24 で確認)、npm。

## セットアップ

```bash
npm install
npm run dev     # 開発サーバー(--host 有効。スマホ実機からは表示される Network URL で確認)
npm run build   # 型チェック + 本番ビルド
npm run preview # ビルド結果の確認
npm run lint    # oxlint
```

## ディレクトリ構成

```
src/
├── assets/       ロゴアセットのパス定義(logos.ts)
├── components/   共通UI(AppShell, AppHeader, OpeningSplash, Loading, LoadingDots,
│                        HintList, TypingInput, HandwritingCanvas, BloomLogo, BloomMark)
├── config/       ヒント間隔・トライアル上限・編集距離の許容量など調整パラメータ
├── data/         ジャンル定義とサンプル問題セット
├── features/
│   ├── hints/    ジャンル別ヒント分解ルール(english / kanji)とレジストリ
│   └── judge/    正誤判定(レベル1: 正規化一致 / レベル2: 編集距離)
├── hooks/        useHintTimer, useStats
├── pages/        画面(トップ / ジャンル選択 / 出題 / 結果 / マイページ / トライアル終了)
├── utils/        小さな共通処理(prefersReducedMotion)
├── services/     永続化(statsRepository, quizSession, openingSession)
└── types/        ドメイン型
```

## 実装上のメモ

### 漢字問題の生成

漢字ジャンルの問題は KANJIDIC2(部首・画数・音読み)と KRADFILE(構成パーツ)から
生成している。**実行時に辞書APIを叩くのではなく、開発時に生成して JSON をコミットする。**

```bash
npm run dict:fetch                          # 初回のみ
npm run questions:kanji                     # 既定は小学3〜6年配当 → 333問
npm run questions:kanji -- --grades=8       # 中学以上の常用漢字
npm run questions:kanji -- --report         # 書き出さず、内訳と先頭20問だけ確認
```

出力は `src/data/questions.kanji.generated.json`。直接編集しても次回生成で消える。
手で直したい問題は `src/data/questions.ts` の `MANUAL_QUESTIONS` に置く(同じ `answer` があれば生成側を捨てる)。

生成側は「作れないヒントは書かない」方針で、次の条件に当てはまる字は問題にしない。
`--report` の除外内訳で数が見える。

| 除外 | 理由 |
|---|---|
| 主要な訓読みが他の漢字と重複 | 「あつい」→熱/暑/厚 のように出題文から答えが一意に決まらない |
| 単独で出せる訓読みが無い | 音読みのみの字、熟語内でしか現れない読み(`-じるし`)しか無い字 |
| ヒントが3個未満 | 部首が字そのもの(木・山)で部首ヒントを作れない字など |
| 訓読みが1文字 | 「や」→屋 は一意でも手がかりにならない |

部首まわりの手入力テーブルは `scripts/kanji-radicals.ts`。
KANJIDIC2 の部首名は214個中97個しか無く、KRADFILE は部首を代表字に正規化している
(亻→化、艹→艾)ため、ここを人手で補っている。ヒントの字が違うときはこの表を見る。

`hintSource` は `見出し|本文` 形式(`部首|亻(にんべん)`)。
出せるヒントの種類は字ごとに変わるので、見出しは並び順ではなくデータ側が持つ。

### ジャンルを追加するとき

ヒントの出しかたはジャンルごとに個別設計する方針のため、共通ロジックには寄せない。

1. `src/types/index.ts` の `GenreId` に ID を追加
2. `src/features/hints/<genre>.ts` にヒント分解ルールを実装し、`src/features/hints/index.ts` の `HINT_RULES` に登録
3. `src/data/genres.ts` と `src/data/questions.ts` にジャンル・問題を追加

### ロゴと配色

ロゴアセットは `public/` に置いてある。

| ファイル | 用途 |
|---|---|
| `public/bloomstudy_icon.svg` | 縦組みロゴ・アニメーション版。オープニング演出で使用 |
| `public/bloomstudy_logo.svg` | 横組みロゴ・アニメーション版 |
| `public/bloomstudy_icon_static.svg` | 縦組みロゴ・静止版(アニメーションを外しただけ) |
| `public/bloomstudy_logo_static.svg` | 横組みロゴ・静止版。ヘッダーで使用。ヘッダーに収まるよう、図形の座標はそのままに viewBox をコンテンツの実測値に合わせて詰めてある |
| `public/favicon.svg` | 花びらモチーフを正方形に切り出した静止版。ファビコン専用 |

`BloomLogo` が `variant`(縦組み / 横組み)と `animated`(既定 false)でこの4ファイルを出し分ける。

ロゴ単体ファイルのアニメーションはSVG内のSMILで完結しているため `<img>` で読み込む。
アニメーションは `repeatCount="1"` + `fill="freeze"` で**1回だけ再生して完成形で止まる**。
ループさせると2.4秒ごとにロゴが消えて出直すうえ、静止画としてラスタライズされる場面
(ファビコン・OGP画像など)で `opacity:0` の途中フレームが出てしまうため、
ファビコンにはアニメーションを含まない `favicon.svg` を使っている。

### ヘッダーとオープニング演出

- `AppHeader` を `AppShell` に組み込んであるので、全画面のヘッダー左に横組みロゴ(静止版)が出る。ロゴはトップへのリンク。右側は今後のナビゲーション用に空けてある
- `OpeningSplash` がトップ画面を開いたときに縦組みロゴを全画面で1回再生し、フェードアウトして本編に渡す
- 再生は**1セッションにつき1回**。判定は `src/services/openingSession.ts`(`sessionStorage`)。他画面から戻ってきても再生しない
- `prefers-reduced-motion: reduce` のときは演出をスキップする

演出の尺は `OpeningSplash.tsx` の定数で調整する。

| 定数 | 既定 | 意味 |
|---|---|---|
| `LEAD_IN_MS` | 600ms | ロゴを出してから花が開き始めるまでの間 |
| `LOGO_MOTION_MS` | 1300ms | SVG側の動きが完成形に達するまで(`dur="2.4s"` × 文字が出そろう `keyTimes` 0.5417) |
| `HOLD_MS` | 500ms | 完成したロゴを見せておく時間 |
| `FADE_MS` | 400ms | フェードアウト |
| `MAX_WAIT_MS` | 4000ms | 読み込みが返ってこなくても本編に進む上限 |

ロゴの下には `LoadingDots`(3点が順に跳ねるマーク)を出す。これは飾りではなく、
**演出の尺と実際の読み込み(`document.fonts.ready`)の両方が終わるまで**スプラッシュが閉じない。
フォントが遅い回線では演出が終わってもドットが回り続け、揃った時点でフェードアウトする。
ロゴが出た瞬間にドットが下へずれないよう、ロゴの領域は `aspect-[400/360]` で最初から確保している。

`<img>` はDOMに挿入された時点でSMILが動き出すため、**lead-in のあいだは `<img>` をマウントしない**。
同じ理由で、先読みは `<img>` ではなく `fetch()` で行っている(画像として先読みすると時計が先に動く)。
`LOGO_MOTION_MS` はSVG側の `dur` に依存しているので、**SVGの尺を変えたらこちらも合わせること**。

### ローディング表示

ローディング表示は2種類ある。用途で使い分ける。

| コンポーネント | 見た目 | 用途 |
|---|---|---|
| `Loading` | 花びらが開閉 + 文言 | 画面の中身を待つとき(マイページ、出題画面など) |
| `LoadingDots` | 3点のドット | 花のモチーフと重ねたくない場所。オープニングのロゴ下 |

`Loading` が花びらの開閉アニメーション(`BloomMark motion="loop"`)と文言を出す。

- `delayMs`(既定 200ms)を過ぎるまで何も描かないので、一瞬で終わる読み込みではチラつかない
- 数秒以上かかる処理では `hint` に待ち時間の見込みを添える。機能要件書3章の通り、
  レベル4(Transformers.js)の初回モデル読み込みを入れるときは必ず明示すること

```tsx
<Loading />
<Loading message="記録をよみこみ中" />
<Loading message="判定の準備をしています" hint="初回だけ十数秒かかります" delayMs={0} />
```
一方、UI内の演出(結果画面など)は `BloomMark` が同じ形状・配色を Web Animations API で描き直している。
**片方の形や色を変えたら、もう片方も合わせること。**

配色トークンは `src/index.css` の `@theme` にあり、すべてロゴから採色している。

| トークン | 値 | 由来 |
|---|---|---|
| `bloom-400` / `bloom-500` | `#5DCAA5` / `#3FBE93` | 花びら |
| `bloom-700` | `#0F6E56` | 花の中心。主要ボタン・正解表示に使う |
| `ink-900` | `#23292B` | ロゴのワードマーク |
| `warm-500` / `warm-600` | `#E07A5F` / `#C25A3E` | 不正解・「ちがった」の表現(緑一色の中で区別をつけるため) |

正誤は色だけに頼らず、⭕️/✖️ アイコンとテキストを併記する。

### 出題データの取り出しかた

出題は「全問リストを取得して画面が切り出す」形にしていない。
**1回分の出題セットを受け取り、返ってきた数がすべてとして扱う。**

```
QuizPage → useQuizSession → quizSource.startSession(genreId) → QuizSession { questions }
                         ↘ quizSession(sessionStorage) で結果画面をはさんでも復元
```

何問返すか・どの順で返すかを決めるのは [src/services/quizSource.ts](src/services/quizSource.ts) の責務で、
画面はカタログの総数も未出題の残りも知らない。要件定義書7章の
「プランに応じて問題数が増える」を後から足すには、この情報を画面に渡していないことが前提になる。

| | いまの実装 | サーバー導入後 |
|---|---|---|
| 出題元 | バンドルした生成JSON | `fetch('/api/session')` |
| 何問返すか | `TRIAL_LIMIT - trialUsed` をクライアントで計算 | サーバーがプランを見て決める |
| 出題順 | シャッフル | 復習・間隔反復をサーバー側で |

差し替えるのは `quizSource` の実装1つで、`QuizSource` / `QuizSession` の形と画面側は変えない。
`statsRepository` と同じ差し替えかた。

**注意**: いまはトライアル残数の計算がクライアントにあるため、`localStorage` を消せば無制限に解ける。
課金を始めるなら、この判断はサーバー実装へ移すこと(移す先が `quizSource` に決まっているのがこの設計の狙い)。

### バックエンド(Firebase / Supabase)

技術選定書 6章の通り採用は未確定のため、MVP では `localStorage` 実装で動かしている。
差し替え点は `src/services/statsRepository.ts` の `StatsRepository` インターフェースに閉じてあるので、
採用時は同じインターフェースの実装を足して `statsRepository` を差し替える。

### 未実装(将来フェーズ)

- レベル3(LanguageTool API による文法チェック)
- レベル4(Transformers.js + `all-MiniLM-L6-v2` による意味的類似度判定)
- サブスク決済(Stripe)

## クレジット

漢字問題の生成に、Electronic Dictionary Research and Development Group (EDRDG) の
KANJIDIC2 と KRADFILE を使用している。いずれも **CC BY-SA 4.0**。

- [KANJIDIC Project](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)
- [EDRDG License](https://www.edrdg.org/edrdg/licence.html)
- JSON 化: [jmdict-simplified](https://github.com/scriptin/jmdict-simplified)

ライセンス上、**アプリ内に出典を掲示する画面が必要**(起動時の一瞬の表示では要件を満たさない)。
マイページなどに固定の表示先を用意すること。ShareAlike のため、生成した問題データを
再配布する場合も同じライセンスになる。

## 追跡しないファイル

`.gitignore` に入れてあるもののうち、意図が分かりにくいもの:

| パターン | 理由 |
|---|---|
| `.dict-cache/` | KANJIDIC2 / KRADFILE のダウンロードキャッシュ。十数MBあり、スクリプトで再取得できる |
| `.env` / `.env.*` | BaaS のキーなどを入れる想定。共有用の `.env.example` だけ例外的に追跡する |

逆に `src/data/questions.kanji.generated.json` は自動生成だが**追跡する**。
100KB弱でビルドに必要なアプリデータであり、辞書データを持っていない環境でもビルドできるようにするため。

## デプロイ

Vercel を想定。`vercel.json` で SPA のフォールバックを設定済み(ビルドコマンド `npm run build`、出力 `dist`)。
