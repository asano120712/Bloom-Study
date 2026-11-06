import parts from '@/data/parts.kanji.generated.json'
import { assemblyOfParts } from '@/features/assemble'
import type { Question } from '@/types'

/**
 * 小1・小2の漢字の「組み立て」の問題。
 *
 * この学年は熟語の穴うめが成立しない(出題文に出る相手の字が読めない)ので、
 * 問題文のかわりにお手本の字そのものを見せて、覚えてから部品で組ませる(modelPrompt)。
 * 出題・判定・結果・記録は、小3以上の「パーツを組む」と同じ出題画面がそのまま受け持つ。
 *
 * 部品とタイルは生成データ(npm run parts:kanji)、
 * どちらが左(上)かは features/assemble の表が持つ。
 */
export const buildQuestions: Question[] = parts.characters.flatMap((entry) =>
  assemblyOfParts(entry.char, entry.parts)
    ? [
        {
          id: `kj-build-${entry.char}`,
          genreId: 'kanji' as const,
          prompt: entry.char,
          answer: entry.char,
          level: 'g12' as const,
          parts: entry.parts,
          partTiles: entry.partTiles,
          modelPrompt: true,
        },
      ]
    : [],
)
