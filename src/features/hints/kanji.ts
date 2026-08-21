import type { HintRule, HintStep, Question } from '@/types'

/**
 * 漢字ジャンルのヒント分解ルール。
 * 文字を機械的に切るのではなく、問題データに手で登録した部首・パーツ列
 * (question.hintSource)を順に開放する。
 */
export const kanjiHintRule: HintRule = {
  genreId: 'kanji',
  build: (question: Question): HintStep[] => {
    const parts = question.hintSource ?? []
    const captions = ['部首', 'つくりの一部', '字形のヒント', '読みのヒント']

    return parts.map((part, index) => ({
      index,
      caption: captions[index] ?? `ヒント${index + 1}`,
      text: part,
    }))
  },
}
