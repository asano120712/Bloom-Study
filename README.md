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
├── components/   共通UI(AppShell, HintList, TypingInput, HandwritingCanvas, BloomLogo, BloomMark)
├── config/       ヒント間隔・トライアル上限・編集距離の許容量など調整パラメータ
├── data/         ジャンル定義とサンプル問題セット
├── features/
│   ├── hints/    ジャンル別ヒント分解ルール(english / kanji)とレジストリ
│   └── judge/    正誤判定(レベル1: 正規化一致 / レベル2: 編集距離)
├── hooks/        useHintTimer, useStats
├── pages/        画面(トップ / ジャンル選択 / 出題 / 結果 / マイページ / トライアル終了)
├── services/     永続化(statsRepository, quizSession)
└── types/        ドメイン型
```

## 実装上のメモ

### ジャンルを追加するとき

ヒントの出しかたはジャンルごとに個別設計する方針のため、共通ロジックには寄せない。

1. `src/types/index.ts` の `GenreId` に ID を追加
2. `src/features/hints/<genre>.ts` にヒント分解ルールを実装し、`src/features/hints/index.ts` の `HINT_RULES` に登録
3. `src/data/genres.ts` と `src/data/questions.ts` にジャンル・問題を追加

### ロゴと配色

ロゴアセットは `public/` に置いてある。

| ファイル | 用途 |
|---|---|
| `public/bloomstudy_icon.svg` | 縦組みロゴ(アイコン+文字)。トップ画面で `BloomLogo variant="vertical"` が表示 |
| `public/bloomstudy_logo.svg` | 横組みロゴ。`BloomLogo variant="horizontal"` |
| `public/favicon.svg` | 上記の花びらモチーフを正方形に切り出した静止版。16pxで潰れないよう文字とアニメーションは含めない |

ロゴ単体ファイルのアニメーションはSVG内のSMILで完結しているため `<img>` で読み込む。
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

### バックエンド(Firebase / Supabase)

技術選定書 6章の通り採用は未確定のため、MVP では `localStorage` 実装で動かしている。
差し替え点は `src/services/statsRepository.ts` の `StatsRepository` インターフェースに閉じてあるので、
採用時は同じインターフェースの実装を足して `statsRepository` を差し替える。

### 未実装(将来フェーズ)

- レベル3(LanguageTool API による文法チェック)
- レベル4(Transformers.js + `all-MiniLM-L6-v2` による意味的類似度判定)
- サブスク決済(Stripe)

## デプロイ

Vercel を想定。`vercel.json` で SPA のフォールバックを設定済み(ビルドコマンド `npm run build`、出力 `dist`)。
