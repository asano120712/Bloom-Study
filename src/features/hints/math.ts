import type { HintRule, HintStep, Question } from '@/types'

/** hintSource が `見出し|本文` 形式のときだけ分解する。旧形式は本文だけとみなす。 */
function splitCaption(source: string): { caption?: string; text: string } {
  const separator = source.indexOf('|')
  if (separator === -1) return { text: source }
  return { caption: source.slice(0, separator), text: source.slice(separator + 1) }
}

/**
 * 数学ジャンルのヒント分解ルール。
 *
 * 出すのは答えの数字ではなく**解き方の段取り**。
 * 24 × 5 なら「20 と 4 に わける」「20×5 = 100」「4×5 = 20」まで出して、
 * 足すところは解く側に残す(最後のヒントまで出ても答えは言わない)。
 *
 * 段取りは問題の種類ごとに違うので、生成スクリプトが hintSource に書いて渡す。
 * ここは漢字と同じく、並んでいるものを順に開放するだけ。
 */
export const mathHintRule: HintRule = {
  genreId: 'math',
  layout: 'stacked',
  build: (question: Question): HintStep[] =>
    (question.hintSource ?? []).map((source, index) => ({
      index,
      ...splitCaption(source),
    })),
}
