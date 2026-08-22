import type { GenreId, Question } from '@/types'
import generatedKanji from './questions.kanji.generated.json'

/**
 * 手で書いた問題。生成物より優先する(同じ answer があれば生成側を捨てる)。
 * 生成に向かない字や、語釈を添えないと答えが一意に決まらない字はここに置く。
 */
const MANUAL_QUESTIONS: Question[] = [
  { id: 'en-001', genreId: 'english', prompt: 'いちご', answer: 'strawberry' },
  { id: 'en-002', genreId: 'english', prompt: 'ひまわり', answer: 'sunflower' },
  { id: 'en-003', genreId: 'english', prompt: 'としょかん', answer: 'library' },
  { id: 'en-004', genreId: 'english', prompt: 'きせつ', answer: 'season' },
  { id: 'en-005', genreId: 'english', prompt: 'おもいで', answer: 'memory' },

  {
    id: 'kj-001',
    genreId: 'kanji',
    prompt: 'はな(草木のはな)',
    answer: '花',
    hintSource: ['部首|艹(くさかんむり)', 'のこりのパーツ|化', '画数|7画', '音読み|カ'],
  },
  {
    id: 'kj-002',
    genreId: 'kanji',
    prompt: 'やすむ',
    answer: '休',
    hintSource: ['部首|亻(にんべん)', 'のこりのパーツ|木', '画数|6画', '音読み|キュウ'],
  },
]

/**
 * KANJIDIC2 + KRADFILE から生成した漢字問題。
 * 生成は scripts/build-kanji-questions.ts。中身を直接編集しても次回生成で消える。
 */
const GENERATED_QUESTIONS = generatedKanji.questions as Question[]

const manualAnswers = new Set(MANUAL_QUESTIONS.map((question) => question.answer))

/**
 * 本番では BaaS 側から取得する想定のため、参照は questionsOf() 経由に統一する。
 */
const QUESTIONS: Question[] = [
  ...MANUAL_QUESTIONS,
  ...GENERATED_QUESTIONS.filter((question) => !manualAnswers.has(question.answer)),
]

export function questionsOf(genreId: GenreId): Question[] {
  return QUESTIONS.filter((question) => question.genreId === genreId)
}

export function findQuestion(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id)
}
