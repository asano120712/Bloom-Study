/** 出題ジャンル。ジャンル追加時はここと hints のレジストリの両方に登録する。 */
export type GenreId = 'english' | 'kanji'

export type InputMode = 'typing' | 'handwriting'

export interface Genre {
  id: GenreId
  label: string
  description: string
  /** 手書き入力を主とするジャンルかどうか(初期表示モードの決定に使う) */
  defaultInputMode: InputMode
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
  /**
   * ジャンル固有のヒント素材。ジャンルのヒント分解ルールだけが解釈する。
   * 例: 漢字ジャンルでは ['にんべん', 'つくりの上半分', ...] のようなパーツ列。
   */
  hintSource?: string[]
}

/**
 * 開放済みヒントの1段階。
 * ヒント分解ルールはジャンルごとに個別設計する(共通ロジックでは対応しない)。
 */
export interface HintStep {
  /** 0 始まり。経過時間から算出した開放インデックス */
  index: number
  /** 画面に表示するヒント本文 */
  text: string
  /** 「部首」「1文字目」などの見出し。無い場合もある */
  caption?: string
}

/** ジャンル別ヒント分解ルール */
export interface HintRule {
  genreId: GenreId
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
