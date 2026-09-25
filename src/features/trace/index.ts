import hiragana from '@/data/strokes.hiragana.generated.json'
import kanji from '@/data/strokes.kanji.generated.json'

/**
 * なぞりがきのお手本。
 *
 * 字も図形も「書き順どおりに並んだストロークの SVG パス」で持つ。
 * フォントの字形からは書き順を復元できないので、ひらがなは KanjiVG から生成する
 * (scripts/build-kana-strokes.ts)。図形は同じ座標系で手で書く。
 */
export interface TraceItem {
  id: string
  /** 画面に出す名前。読めない子もいるので、絵として見せる字の下に小さく添える程度に使う */
  label: string
  /** 書き順に並んだストローク。VIEW_BOX の正方形の中に収まっている */
  strokes: string[]
}

/** ストロークの座標系。KanjiVG に合わせた正方形 */
export const VIEW_BOX = 109

export type TraceSetId = 'shape' | 'hiragana' | 'kanji'

/**
 * 図形のお手本。運筆の練習で使う順(たて→よこ→ななめ→まる→…)に並べる。
 *
 * 直線から始めて、曲がる・閉じる形へ進む。いきなり「まる」を出すと、
 * 鉛筆を持ちはじめた子には戻ってくる線が難しい。
 */
const SHAPES: TraceItem[] = [
  { id: 'line-v', label: 'たてのせん', strokes: ['M54.5,15 L54.5,94'] },
  { id: 'line-h', label: 'よこのせん', strokes: ['M15,54.5 L94,54.5'] },
  { id: 'line-d', label: 'ななめのせん', strokes: ['M18,91 L91,18'] },
  { id: 'cross', label: 'じゅうじ', strokes: ['M54.5,15 L54.5,94', 'M15,54.5 L94,54.5'] },
  {
    id: 'wave',
    label: 'なみ',
    strokes: ['M14,54.5 C26,28 38,28 50,54.5 C62,81 74,81 86,54.5'],
  },
  { id: 'zigzag', label: 'ぎざぎざ', strokes: ['M14,80 L34,30 L54.5,80 L75,30 L95,80'] },
  {
    id: 'circle',
    label: 'まる',
    strokes: ['M54.5,15 A39.5,39.5 0 0 1 54.5,94 A39.5,39.5 0 0 1 54.5,15'],
  },
  { id: 'triangle', label: 'さんかく', strokes: ['M54.5,16 L92,88 L17,88 Z'] },
  { id: 'square', label: 'しかく', strokes: ['M18,18 L91,18 L91,91 L18,91 Z'] },
]

/**
 * ひらがなのお手本。画数の少ない字から並べる。
 * 生成データは五十音順なので、ここで「なぞりやすい順」に並べ替える。
 */
const KANA: TraceItem[] = [...hiragana.characters]
  .sort((a, b) => a.strokes.length - b.strokes.length)
  .map((entry) => ({ id: `kana-${entry.char}`, label: entry.char, strokes: entry.strokes }))

/**
 * 漢字のお手本。小1・小2の配当だけ(熟語の穴うめがまだ成立しない学年)。
 * 画数の少ない字から出すので、1年の字が先に並ぶ。
 */
const KANJI: TraceItem[] = [...kanji.characters]
  .sort((a, b) => a.strokes.length - b.strokes.length || a.grade - b.grade)
  .map((entry) => ({ id: `kanji-${entry.char}`, label: entry.char, strokes: entry.strokes }))

const SETS: Record<TraceSetId, TraceItem[]> = { shape: SHAPES, hiragana: KANA, kanji: KANJI }

export function isTraceSet(value: string | undefined): value is TraceSetId {
  return value === 'shape' || value === 'hiragana' || value === 'kanji'
}

/** 1回ぶんの出題数。小さい子が飽きる前に「ぜんぶできた」に届く数にする */
export const TRACE_SESSION_SIZE = 5

/**
 * 1回ぶんのお手本を選ぶ。
 *
 * やさしい順に並んだ前半から選ぶ。全部から無作為に選ぶと、
 * 初回に4画の「き」が出て手が止まることがある。
 */
export function traceSession(setId: TraceSetId): TraceItem[] {
  const items = SETS[setId]
  const pool = items.slice(0, Math.max(TRACE_SESSION_SIZE * 3, Math.ceil(items.length / 2)))
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, TRACE_SESSION_SIZE)
}
