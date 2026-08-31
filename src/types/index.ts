/** 出題ジャンル。ジャンル追加時はここと hints のレジストリの両方に登録する。 */
export type GenreId = 'english' | 'kanji'

/**
 * 答えの入力方法。
 * assemble は部品を選んで組み立てる方式。部品は思い出したと申告するまで
 * 見せない(先に見せると再認になり、思い出す練習にならないため)。
 */
export type InputMode = 'typing' | 'handwriting' | 'assemble'

export interface Genre {
  id: GenreId
  label: string
  description: string
  /**
   * そのジャンルで選べる入力方法。
   * 漢字のタイピングのように、答えを打つのに IME が要るジャンルはここから外す。
   * (IME の変換候補に答えが出てしまい、自前キーボードでも変換は肩代わりできない)
   */
  inputModes: InputMode[]
  /** 開始シートで最初に強調する入力方法 */
  defaultInputMode: InputMode
  /**
   * 結果画面で答えを読み上げるときの言語(BCP 47)。
   * 読み方も一緒に覚えられるようにするためのもので、
   * 出題語そのものが読みになっているジャンル(漢字)では設定しない。
   */
  speechLang?: string
}

export interface Question {
  id: string
  genreId: GenreId
  /** 画面に出す出題語。答えは含めない */
  prompt: string
  /** 正解文字列 */
  answer: string
  /** 正解と同等に扱う表記ゆれ(送りがな違い、別綴りなど) */
  acceptableAnswers?: string[]
  /** assemble モードの正解パーツ。順不同の集合として照合する */
  parts?: string[]
  /** assemble モードで並べるタイル(正解パーツ + 見分けにくいダミー) */
  partTiles?: string[]
  /**
   * ジャンル固有のヒント素材。ジャンルのヒント分解ルールだけが解釈する。
   * 漢字ジャンルでは `見出し|本文` 形式のパーツ列
   * (['部首|亻(にんべん)', 'のこりのパーツ|木', '画数|6画', '音読み|キュウ'])。
   */
  hintSource?: string[]
}

/**
 * 開放済みヒントの1段階。
 * ヒント分解ルールはジャンルごとに個別設計する(共通ロジックでは対応しない)。
 *
 * text は前段階までの内容を含まない「その段階で増える分」だけを持つ。
 * 表示側が積み上げるので、累積させると同じ内容が二重に出る。
 */
export interface HintStep {
  /** 0 始まり。経過時間から算出した開放インデックス */
  index: number
  /** その段階で新しく現れる分だけ */
  text: string
  /** 「部首」などの見出し。inline レイアウトでは使わない */
  caption?: string
}

/**
 * ヒントの並べかた。ひとつの枠の中で、段階が増えるたびに追記していく。
 * inline  = 横に連ねる(英単語の綴りが1文字ずつ伸びる)
 * stacked = 行を積む(漢字の部首・パーツ・画数)
 */
export type HintLayout = 'inline' | 'stacked'

/** ジャンル別ヒント分解ルール */
export interface HintRule {
  genreId: GenreId
  layout: HintLayout
  /** 出題語1問あたりの全ヒント段階を生成する */
  build: (question: Question) => HintStep[]
}

export type JudgeVerdict =
  | 'correct'
  /** 編集距離での許容範囲内(タイプミス扱い) */
  | 'near'
  | 'incorrect'
  /** 手書きモードの自己申告 */
  | 'self-correct'
  | 'self-incorrect'

export interface JudgeResult {
  verdict: JudgeVerdict
  /** 正解として扱うか(スコア加算・ストリーク継続の判断に使う) */
  isCorrect: boolean
  /** 結果画面で提示する正解文字列 */
  answer: string
  /** レベル2判定で用いた編集距離。タイピング判定時のみ */
  distance?: number
}

export interface AnswerRecord {
  questionId: string
  genreId: GenreId
  inputMode: InputMode
  verdict: JudgeVerdict
  isCorrect: boolean
  /** 消費したヒント数 */
  hintsUsed: number
  /** ISO 8601 */
  answeredAt: string
}

export interface UserStats {
  totalAnswered: number
  totalCorrect: number
  currentStreak: number
  bestStreak: number
  /** 無料トライアルで消化した問題数 */
  trialUsed: number
  history: AnswerRecord[]
}
