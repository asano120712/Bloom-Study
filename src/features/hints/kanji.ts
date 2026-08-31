import type { HintRule, HintStep, Question } from '@/types'

/** hintSource が `見出し|本文` 形式のときだけ分解する。旧形式は本文だけとみなす。 */
function splitCaption(source: string): { caption?: string; text: string } {
  const separator = source.indexOf('|')
  if (separator === -1) return { text: source }
  return { caption: source.slice(0, separator), text: source.slice(separator + 1) }
}

/**
 * 漢字ジャンルのヒント分解ルール。
 * 文字を機械的に切るのではなく、問題データに登録された部首・パーツ列
 * (question.hintSource)を順に開放する。
 *
 * 出せるヒントの種類と数は字ごとに変わる(部首が字そのものだと部首ヒントを作れない、
 * 分解が筆画レベルまで降りるとパーツヒントを作れない)ため、
 * 見出しは並び順から決めず、hintSource 側が持っている。
 */
export const kanjiHintRule: HintRule = {
  genreId: 'kanji',
  layout: 'stacked',
  build: (question: Question): HintStep[] =>
    (question.hintSource ?? []).map((source, index) => ({
      index,
      ...splitCaption(source),
    })),
}
