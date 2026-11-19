/**
 * 漢字の問題文に使う熟語の意味(ヒントの1つ目)。
 *
 * 辞書(JMdict)の意味は英語しかないので、日本語の意味は手で書いて
 * scripts/data/kanji-meanings.json に置く。キーは `熟語|読み`。
 * 出題文の熟語は生成のたびに選び直されうるので、問題ではなく熟語に結びつける。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MEANINGS_PATH = fileURLToPath(new URL('../data/kanji-meanings.json', import.meta.url))

export function meaningKey(text: string, reading: string): string {
  return `${text}|${reading}`
}

export function readKanjiMeanings(): Map<string, string> {
  const raw = JSON.parse(readFileSync(MEANINGS_PATH, 'utf8')) as Record<string, string>
  return new Map(Object.entries(raw))
}

/** 々(人々)は前の字をくり返す記号なので、学年の上限では見ない */
const KANJI = /[一-龯]/g

/**
 * 意味の文に、出してはいけないものが入っていないかを見る。問題が無ければ空の配列。
 *
 * - 答えの字が入っていると、意味のヒントで答えが見えてしまう(感覚 →「感じとる」)。
 *   同じ熟語が別の字の問題文にもなる(病院 → 病の問題・院の問題)ので、
 *   その熟語を出題文に使う問題すべての答えを避ける(answers)
 * - その学年でまだ習わない漢字は読めない。熟語の相手の字と同じ上限(partnerGradeCap)を使う
 */
export function meaningProblems(
  meaning: string,
  answers: Iterable<string>,
  gradeCap: number,
  gradeOf: Map<string, number>,
): string[] {
  const problems: string[] = []
  const revealed = [...new Set(answers)].filter((c) => meaning.includes(c))
  if (revealed.length > 0) problems.push(`答えの字「${revealed.join('')}」が入っている`)

  const tooHard = [...new Set(meaning.match(KANJI) ?? [])].filter((c) => {
    const grade = gradeOf.get(c)
    return grade === undefined || grade > gradeCap
  })
  if (tooHard.length > 0) problems.push(`まだ習わない漢字: ${tooHard.join('')}`)

  return problems
}
