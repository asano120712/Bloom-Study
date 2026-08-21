import type { GenreId, Question } from '@/types'

/**
 * MVP用のサンプル問題セット。
 * 本番では BaaS 側から取得する想定のため、参照は questionsOf() 経由に統一する。
 */
const QUESTIONS: Question[] = [
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
    hintSource: ['くさかんむり', '下は「化」', '全7画'],
  },
  {
    id: 'kj-002',
    genreId: 'kanji',
    prompt: 'やすむ',
    answer: '休',
    hintSource: ['にんべん', 'つくりは「木」', '人が木によりかかる形'],
  },
  {
    id: 'kj-003',
    genreId: 'kanji',
    prompt: 'おぼえる',
    answer: '覚',
    hintSource: ['下は「見」', '上は「学」の上部と同じ', '全12画'],
  },
]

export function questionsOf(genreId: GenreId): Question[] {
  return QUESTIONS.filter((question) => question.genreId === genreId)
}

export function findQuestion(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id)
}
