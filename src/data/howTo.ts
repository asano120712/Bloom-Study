import type { HowToDemoId } from '@/components/HowToDemo'
import type { ActivityId } from './activities'

/**
 * あそびかたの手順ごとに、どのデモを出すか。
 *
 * 文は言葉の置き場([copy.ts](src/data/copy.ts) の `howTo.steps`)に、
 * 絵はこちらに置く。**絵はモードで変わらない**ので、
 * おとな向け・こども向けで2回書かずに済む。
 *
 * 並び順は文と同じ。足りないぶんは、そのあそびの絵(`art`)になる。
 */
export const HOW_TO_DEMOS: Record<ActivityId, HowToDemoId[]> = {
  english: ['art', 'choice', 'hint', 'read'],
  kanji: ['art', 'choice', 'read', 'slots'],
  math: ['art', 'choice', 'column', 'column', 'read', 'memo'],
  'trace-shape': ['art', 'art'],
  'trace-hiragana': ['art', 'art'],
  'trace-kanji': ['art', 'art'],
  'build-kanji': ['art', 'slots', 'slots'],
  match: ['art', 'art'],
}

export function demosFor(activity: ActivityId, steps: number): HowToDemoId[] {
  const demos = HOW_TO_DEMOS[activity]
  return Array.from({ length: steps }, (_, index) => demos[index] ?? 'art')
}
