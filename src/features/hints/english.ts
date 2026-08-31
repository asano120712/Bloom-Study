import type { HintRule, HintStep, Question } from '@/types'

/**
 * 英語ジャンルのヒント分解ルール。
 *
 * 綴りを先頭から1文字ずつ開放する。表示側が1つの枠に連ねていくため、
 * 各段階が持つのは「その段階で増える1文字」だけ(l → i → b)。
 * 最後の1文字は開放しない(答えそのものになってしまうため)。
 */
export const englishHintRule: HintRule = {
  genreId: 'english',
  layout: 'inline',
  build: (question: Question): HintStep[] => {
    const letters = [...question.answer]
    const revealable = Math.max(0, letters.length - 1)

    return letters.slice(0, revealable).map((letter, index) => ({
      index,
      text: letter,
    }))
  },
}
