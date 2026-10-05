/**
 * だれ向けの画面か。トップはモードごとに別ページにする(`/` と `/kids`)。
 * 出題・結果までは共通で、あとからジャンルをモードで出し分ける。
 */
export type AudienceMode = 'adult' | 'kids'

/** モードごとのトップページ。ヘッダーの切り替えもここを行き先にする */
export const TOP_PATH: Record<AudienceMode, string> = {
  adult: '/',
  kids: '/kids',
}

/** 出題ジャンル。ジャンル追加時はここと hints のレジストリの両方に登録する。 */
export type GenreId = 'english' | 'kanji' | 'math'

/**
 * 出題の難易度。**だれ向けか**で切る。
 *
 * 何を根拠に割り当てるかはジャンルで違う。漢字は小学校のあいだは配当学年
 * (国が決めている学年別漢字配当表)、中学以上は出現頻度。中学校の学習指導要領は
 * 字を学年に割り当てていないので、学年では割れない。
 * 英単語は NGSL の頻度帯しか持たないので、中学生・高校生・社会人の3つだけ。
 */
export type Difficulty = 'g12' | 'g34' | 'g56' | 'junior' | 'senior' | 'working'

/** やさしい順。選択シートはこの順で並べる */
export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  'g12',
  'g34',
  'g56',
  'junior',
  'senior',
  'working',
]

export function isDifficulty(value: string | null | undefined): value is Difficulty {
  return DIFFICULTY_ORDER.includes(value as Difficulty)
}

/**
 * 答えの入力方法。
 * assemble は2つの部品を1つのマス(左右または上下に割れる)へ組んで漢字を作る方式。
 * 部品は思い出したと申告するまで見せない
 * (先に見せると再認になり、思い出す練習にならないため)。
 */
export type InputMode = 'typing' | 'handwriting' | 'assemble' | 'number'

/**
 * 結果画面のおてほんに敷くガイド。
 * grid     = 1文字ずつマスに入れる(漢字ドリルのマス目)
 * baseline = 英語ノートの罫線に単語を置く
 * plain    = ガイドを敷かずに大きく出す(数の答えは字形をなぞる対象ではない)
 */
export type AnswerGuide = 'grid' | 'baseline' | 'plain'

/**
 * ジャンルの「構造」。ラベル・説明・出題語の見出しといった言葉は
 * モードで変わるため src/data/copy.ts の genres が持つ。
 */
export interface Genre {
  id: GenreId
  /**
   * 結果画面で正解を「おてほん」として見せるときのガイド。
   * 字の形をどう追わせたいかはジャンルで変わるため、画面側で分岐せずここで持つ。
   */
  answerGuide: AnswerGuide
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
  /**
   * 出題語の読み。出題語だけでは語が一つに決まらないときに添える。
   * 漢字ジャンルは熟語の穴うめ(「◯営」うんえい → 運)なので、
   * 読みが無いと ◯ に入る字を絞れない(◯営 は 運営 / 経営 / 陣営…)。
   */
  promptReading?: string
  /**
   * 出題語の見せ方。'column' は筆算(縦に積んで桁をそろえる)。
   *
   * 2桁以上のかけ算を1行で出すと暗算に近くなり、小3・4には難しい。
   * 筆算はこの学年で習う形なので、縦に積むほうが解きやすく、位をそろえる練習にもなる。
   * 指定が無ければそのまま1行で出す。
   */
  promptLayout?: 'column'
  /** 正解文字列 */
  answer: string
  /**
   * 難易度。無い問題は難易度で絞り込むと出せなくなるため、
   * 出題側(quizSource)は未設定を「ふつう」として扱う。
   */
  level?: Difficulty
  /** 正解と同等に扱う表記ゆれ(送りがな違い、別綴りなど) */
  acceptableAnswers?: string[]
  /**
   * KRADFILE 由来の部品。assemble モードはこのうち2部品に割れる字だけを出す。
   * KRADFILE には配置(左右・上下)が無いので、割れる向きと先にくる部品は
   * features/assemble の表で補う。
   */
  parts?: string[]
  /** assemble モードで並べるタイル(正解の部品 + 見分けにくいダミー) */
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
