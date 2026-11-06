import kanji from '@/data/strokes.kanji.generated.json'
import type { Question } from '@/types'

/**
 * 小1・小2の漢字のなぞり書きの問題。
 *
 * 薄いお手本の上に自分の手で書き、お手本と1画ずつ比べてきれいさを見る(features/trace/judge)。
 * 出題・結果・記録は、ほかの漢字の問題と同じ出題画面が受け持つ(trace モード)。
 * お手本の線は KanjiVG から生成したもの(npm run strokes)。
 */
export const traceQuestions: Question[] = kanji.characters.map((entry) => ({
  id: `kj-trace-${entry.char}`,
  genreId: 'kanji',
  prompt: entry.char,
  answer: entry.char,
  level: 'g12',
  strokes: entry.strokes,
}))
