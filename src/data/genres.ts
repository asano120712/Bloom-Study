import type { Difficulty, Genre, GenreId, InputMode, MathTopic } from '@/types'

/** ジャンルの構造。表に出る言葉はモードごとに src/data/copy.ts が持つ */
export const GENRES: Genre[] = [
  {
    id: 'english',
    // 英語ノートの罫線に置く。大文字・小文字の高さの違いまで手本にしたいため
    answerGuide: 'baseline',
    speechLang: 'en-US',
  },
  {
    id: 'kanji',
    // マスに1文字ずつ入れる。中心と字の大きさを合わせるのが漢字の手本なので
    answerGuide: 'grid',
  },
  {
    id: 'math',
    // 答えは数。字形をなぞる対象ではないので、ガイドは敷かずに大きく出す
    answerGuide: 'plain',
  },
]

export function findGenre(id: string): Genre | undefined {
  return GENRES.find((genre) => genre.id === id)
}

/**
 * そのジャンルで選べる難易度。
 *
 * 英単語に小学生向けが無いのは、学習指導要領が語数しか決めておらず、
 * 学年に対応づけられる語彙データが存在しないため(NGSL の頻度帯しか持てない)。
 */
const DIFFICULTIES: Record<GenreId, Difficulty[]> = {
  kanji: ['g12', 'g34', 'g56', 'junior', 'senior', 'working'],
  english: ['junior', 'senior', 'working'],
  // 小1・2は たし算・ひき算、小3・4は 3桁の加減とかけ算・わり算、小5・6は大きい数のかけ算・わり算。
  // 学年を足すときは、生成スクリプトに種類を足してからここを広げること
  math: ['g12', 'g34', 'g56'],
}

/**
 * 学年ごとに選べる計算の種類(計算ジャンルだけ)。
 *
 * 問題データを読む前に(こたえかたを選ぶシートで)並べたいので、ここに持つ。
 * 生成スクリプトでその学年に種類を足したら、ここにも足すこと。
 */
const MATH_TOPICS: Partial<Record<Difficulty, MathTopic[]>> = {
  g12: ['add', 'sub'],
  g34: ['add', 'sub', 'mul', 'div'],
  g56: ['mul', 'div', 'decimal', 'fracAdd', 'fracMul', 'ratio', 'speed'],
}

export function mathTopicsOf(genreId: GenreId, difficulty: Difficulty): MathTopic[] {
  return genreId === 'math' ? (MATH_TOPICS[difficulty] ?? []) : []
}

/**
 * 種類を選ぶときに添える式の例。「かけ算」だけでは、何けたの計算なのかが分からない
 * (同じかけ算でも、小3・4は 2けた×2けた、小5・6は 3けた×2けた)。
 * 言葉で説明するより式を1つ見せるほうが、こども向けでも おとな向けでも早く伝わる。
 */
const MATH_TOPIC_EXAMPLES: Partial<Record<Difficulty, Partial<Record<MathTopic, string>>>> = {
  g12: { add: '8 + 5', sub: '13 − 7' },
  g34: { add: '375 + 248', sub: '532 − 187', mul: '37 × 24', div: '588 ÷ 7' },
  g56: {
    mul: '375 × 24',
    div: '936 ÷ 24',
    fracAdd: '2/3 + 1/4',
    fracMul: '3/4 ÷ 2/5',
    decimal: '2.4 × 3.5',
    ratio: '40人の 75%は 何人?',
    speed: '120km を 2時間で 走る 時速は?',
  },
}

export function mathTopicExample(difficulty: Difficulty, topic: MathTopic): string {
  return MATH_TOPIC_EXAMPLES[difficulty]?.[topic] ?? ''
}

export function difficultiesOf(genreId: GenreId): Difficulty[] {
  return DIFFICULTIES[genreId]
}

/**
 * 筆算で出す問題があるか。
 *
 * ある学年だけ「筆算で解く / 1行の式で解く」を選べるようにしたいので、
 * 問題データを読む前に(こたえかたを選ぶシートで)判断できる形にしてある。
 * 小1・2は1桁どうしの暗算なので筆算にしない。
 */
const COLUMN_LEVELS: Difficulty[] = ['g34', 'g56', 'junior', 'senior', 'working']

/** 分数の種類。筆算が無いので、解く形(筆算か1行か)を聞かない */
/** 筆算が無い種類(分数・文章題)。解く形(筆算か1行か)を聞かない */
const FRACTION_TOPICS: MathTopic[] = ['fracAdd', 'fracMul', 'ratio', 'speed']

export function hasColumnForm(genreId: GenreId, difficulty: Difficulty, topic?: MathTopic): boolean {
  if (topic && FRACTION_TOPICS.includes(topic)) return false
  return genreId === 'math' && COLUMN_LEVELS.includes(difficulty)
}

/**
 * こたえかたの選択肢。
 *
 * クイズのこたえかた(inputMode)と、別画面のあそび(path)が並ぶ。
 * 小1・小2の漢字は熟語の穴うめが成立しない(出題文に出る相手の字が読めない)ので、
 * この学年だけ なぞりがき と くみたて に差し替える。
 */
export type AnswerChoiceId = InputMode | 'trace' | 'build'

export interface AnswerChoice {
  id: AnswerChoiceId
  /** クイズのこたえかた。あそびの場合は持たない */
  inputMode?: InputMode
  /** あそびの行き先。クイズの場合は持たない */
  path?: string
}

/**
 * パーツを組むを出せる難易度。
 *
 * 組み立てには「左右・上下のどちらに割れるか」が要るが、KRADFILE は配置を持たない。
 * features/assemble の表に手で持っている字しか出せず、いまは小3〜小6ぶんしかない
 * (小3・4で58問、小5・6で41問)。中学以上を出すには、まず表を増やすこと。
 * ここを直さずに出すと、問題が0問のセットになって「おわり」画面へ飛ぶ。
 */
const ASSEMBLE_LEVELS: Difficulty[] = ['g34', 'g56']

const QUIZ_CHOICES: Record<GenreId, AnswerChoice[]> = {
  // 手書きを先頭に置く。書いて思い出すのが基本のこたえかたなので、
  // シートでも最初に目に入る位置にする(並び順がそのままシートの並びになる)
  english: [
    { id: 'handwriting', inputMode: 'handwriting' },
    { id: 'typing', inputMode: 'typing' },
  ],
  // 漢字を打つには IME が要り、変換候補に答えが出てしまうためタイピングは置かない
  kanji: [
    { id: 'handwriting', inputMode: 'handwriting' },
    { id: 'assemble', inputMode: 'assemble' },
  ],
  // 数は打つほうが速く、読み取りの間違いも起きないので先に置く。手書きも字を読み取って自動で判定する
  math: [
    { id: 'number', inputMode: 'number' },
    { id: 'handwriting', inputMode: 'handwriting' },
  ],
}

/** 小1・小2の漢字。クイズではなく、なぞって覚える・部品から組み立てる */
const KANJI_LOW_CHOICES: AnswerChoice[] = [
  { id: 'trace', path: '/trace/kanji' },
  { id: 'build', path: '/build' },
]

export function answerChoicesOf(genreId: GenreId, difficulty: Difficulty): AnswerChoice[] {
  if (genreId === 'kanji' && difficulty === 'g12') return KANJI_LOW_CHOICES

  return QUIZ_CHOICES[genreId].filter(
    (choice) => choice.id !== 'assemble' || ASSEMBLE_LEVELS.includes(difficulty),
  )
}
