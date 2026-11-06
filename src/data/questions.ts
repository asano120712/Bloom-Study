import { buildQuestions } from '@/features/build'
import type { GenreId, Question } from '@/types'

/**
 * 手で書いた問題。生成物より優先する(同じ answer があれば生成側を捨てる)。
 * 生成に向かない字や、生成の対象学年から外れる字(小1・小2)はここに置く。
 *
 * 小1・小2の熟語(下の2問)は、いまは出題に回らない(この学年は なぞりがき と
 * お手本を見て組む組み立て に差し替えてある)。熟語でも出したくなったときのために残してある。
 */
const MANUAL_QUESTIONS: Question[] = [
  { id: 'en-001', genreId: 'english', prompt: 'いちご', answer: 'strawberry', level: 'junior' },
  { id: 'en-002', genreId: 'english', prompt: 'ひまわり', answer: 'sunflower', level: 'junior' },
  { id: 'en-003', genreId: 'english', prompt: 'としょかん', answer: 'library', level: 'junior' },
  { id: 'en-004', genreId: 'english', prompt: 'きせつ', answer: 'season', level: 'junior' },
  { id: 'en-005', genreId: 'english', prompt: 'おもいで', answer: 'memory', level: 'junior' },

  // 漢字は熟語の穴うめで出す。部首・パーツ・画数はヒントにも出さない
  // (パーツを答えさせるモードで答えそのものになるため)
  {
    id: 'kj-001',
    genreId: 'kanji',
    prompt: '「◯火」',
    promptReading: 'はなび',
    answer: '花',
    level: 'g12',
    hintSource: ['熟語|「◯束」はなたば', '熟語|「生◯」いけばな', '訓読み|はな'],
  },
  {
    id: 'kj-002',
    genreId: 'kanji',
    prompt: '「◯日」',
    promptReading: 'きゅうじつ',
    answer: '休',
    level: 'g12',
    hintSource: ['熟語|「◯憩」きゅうけい', '熟語|「連◯」れんきゅう', '訓読み|やすむ'],
  },
]

/**
 * 辞書から生成した問題。中身を直接編集しても次回生成で消える。
 * 漢字: scripts/build-kanji-questions.ts / 英単語: scripts/build-english-questions.ts
 * 計算: scripts/build-math-questions.ts(辞書は使わず規則で作る)
 *
 * **ジャンルごとに、使うときだけ読む。** まとめて読むと、計算をやる人も
 * 漢字と英単語のデータ(合わせて1MB超)を一緒に読むことになる。
 * 1ジャンルぶんなら、その3分の1以下で済む。
 */
const LOADERS: Record<GenreId, () => Promise<{ default: { questions: unknown[] } }>> = {
  kanji: () => import('./questions.kanji.generated.json'),
  english: () => import('./questions.english.generated.json'),
  math: () => import('./questions.math.generated.json'),
}

/** 一度読んだジャンルは覚えておく。問題を出すたびに読み直さない */
const loaded = new Map<GenreId, Promise<Question[]>>()

const manualAnswers = new Set(MANUAL_QUESTIONS.map((question) => question.answer))

/**
 * そのジャンルの問題。
 *
 * 本番では BaaS 側から取得する想定のため、参照はこの関数経由に統一する。
 * 取得が非同期なのは、いまのファイル読み込みでも将来の通信でも同じ形にするため。
 */
export function questionsOf(genreId: GenreId): Promise<Question[]> {
  const cached = loaded.get(genreId)
  if (cached) return cached

  const loading = Promise.all([
    LOADERS[genreId](),
    // 小1・小2のなぞり書き。お手本の線(150KB ほど)を持つので、漢字のときだけ読む
    genreId === 'kanji' ? import('@/features/trace/questions').then((m) => m.traceQuestions) : [],
  ]).then(([module, traces]) => {
    const generated = module.default.questions as Question[]
    const manual = MANUAL_QUESTIONS.filter((question) => question.genreId === genreId)
    return [
      ...manual,
      // 小1・小2の組み立て(お手本を見て組む)。部品のデータから作る
      ...(genreId === 'kanji' ? buildQuestions : []),
      ...traces,
      // 手で書いたものを優先する(同じ答えがあれば生成側を捨てる)
      ...generated.filter((question) => !manualAnswers.has(question.answer)),
    ]
  })
  loaded.set(genreId, loading)
  return loading
}

/**
 * 1問を id で引く。履歴の表示に使う。
 *
 * ジャンルも一緒に受け取るのは、どのファイルを読めばよいか決めるため
 * (id だけだと全ジャンルを読むことになり、分けた意味が無くなる)。
 */
export async function findQuestion(
  genreId: GenreId,
  id: string,
): Promise<Question | undefined> {
  return (await questionsOf(genreId)).find((question) => question.id === id)
}
