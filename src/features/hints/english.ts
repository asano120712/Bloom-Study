import type { HintRule, HintStep, Question } from '@/types'

/**
 * 英語ジャンルのヒント分解ルール。
 * 英数字を1文字ずつ増やして出す(i → ic → ich → ichi → …)。
 * 最後の1文字は開放しない(答えそのものになってしまうため)。
 */
export const englishHintRule: HintRule = {
  genreId: 'english',
  build: (question: Question): HintStep[] => {
    const letters = [...question.answer]
    const maxSteps = Math.max(0, letters.length - 1)

    return Array.from({ length: maxSteps }, (_, index) => ({
      index,
      caption: `${index + 1}文字目まで`,
      text: letters.slice(0, index + 1).join(''),
    }))
  },
}
