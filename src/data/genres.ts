import type { Difficulty, Genre, GenreId, InputMode } from '@/types'

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
  // 小1・2は たし算・ひき算、小3・4は 3桁の加減とかけ算・わり算。
  // 学年を足すときは、生成スクリプトに種類を足してからここを広げること
  math: ['g12', 'g34'],
}

export function difficultiesOf(genreId: GenreId): Difficulty[] {
  return DIFFICULTIES[genreId]
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
  // 数は打って答えるほうが自動で正誤を見られる。手書きは自己申告なので後ろに置く
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
