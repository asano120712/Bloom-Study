import parts from '@/data/parts.kanji.generated.json'
import { assemblyOfParts, type Assembly } from '@/features/assemble'

/**
 * こども向けの「かんじを くみたてよう」。
 *
 * 小1・小2の漢字を、お手本を見てから部品で組み立てる。
 * この学年は熟語の穴うめが成立しない(出題文に出る相手の字が読めない)ので、
 * 問題文のかわりにお手本の字そのものを見せて、覚えてから組ませる。
 *
 * 部品とタイルは生成データ(npm run parts:kanji)、
 * どちらが左(上)かは features/assemble の表が持つ。
 */
export interface BuildItem {
  char: string
  grade: number
  /** 並べるタイル(正解の2部品 + ダミー) */
  partTiles: string[]
  assembly: Assembly
}

/** 表に載っていて組み立てられる字だけ。画数の少ない字から並べる */
const ITEMS: BuildItem[] = parts.characters
  .flatMap((entry) => {
    const assembly = assemblyOfParts(entry.char, entry.parts)
    return assembly
      ? [{ char: entry.char, grade: entry.grade, partTiles: entry.partTiles, assembly }]
      : []
  })
  .sort((a, b) => a.grade - b.grade)

/** 1回ぶんの出題数。なぞりがきと揃える */
export const BUILD_SESSION_SIZE = 5

export function buildSession(): BuildItem[] {
  const shuffled = [...ITEMS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, BUILD_SESSION_SIZE)
}

/** 組み立てられる字の数。一覧に出すかどうかの判断に使う */
export const BUILDABLE_COUNT = ITEMS.length
