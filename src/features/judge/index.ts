import levenshtein from 'fast-levenshtein'
import { levenshteinTolerance } from '@/config'
import { assemblyOf } from '@/features/assemble'
import type { JudgeResult, Question } from '@/types'

/**
 * レベル1(正規化一致)の正規化処理。
 * 大文字小文字の統一、前後・連続空白の除去、全角英数の半角化を行う。
 */
export function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** 正解候補(正解 + 表記ゆれ)を列挙する */
function candidatesOf(question: Question): string[] {
  return [question.answer, ...(question.acceptableAnswers ?? [])]
}

/**
 * タイピング入力の正誤判定。
 * レベル1(正規化一致)で判定し、外れた場合にレベル2(編集距離)であいまい判定する。
 */
export function judgeTyping(question: Question, input: string): JudgeResult {
  const normalizedInput = normalize(input)
  const candidates = candidatesOf(question)

  if (candidates.some((candidate) => normalize(candidate) === normalizedInput)) {
    return { verdict: 'correct', isCorrect: true, answer: question.answer, distance: 0 }
  }

  let bestDistance = Number.POSITIVE_INFINITY
  let bestCandidate = question.answer
  for (const candidate of candidates) {
    const distance = levenshtein.get(normalize(candidate), normalizedInput)
    if (distance < bestDistance) {
      bestDistance = distance
      bestCandidate = candidate
    }
  }

  const isNear = bestDistance <= levenshteinTolerance(normalize(bestCandidate).length)
  return {
    verdict: isNear ? 'near' : 'incorrect',
    isCorrect: isNear,
    answer: question.answer,
    distance: bestDistance,
  }
}

/**
 * 数で答えるときの判定。
 *
 * 文字列の一致ではなく**数として**見る。全角で打たれた「１２０」、前の 0、
 * 区切りのカンマ、前後の空白は、どれも同じ数を指しているのに文字としては別物になる。
 * 正規化(NFKC + 記号の除去)してから数に直して比べる。
 *
 * 小数や分数はまだ出題していない。出すときは、ここに
 * 「0.5 と 1/2 と .5 を同じとみなすか」の判断を足すこと。
 */
export function judgeNumber(question: Question, input: string): JudgeResult {
  const toNumber = (value: string) => {
    const normalized = value.normalize('NFKC').replace(/[\s,]/g, '')
    return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null
  }

  const answered = toNumber(input)
  const isCorrect =
    answered !== null && candidatesOf(question).some((candidate) => toNumber(candidate) === answered)

  return {
    verdict: isCorrect ? 'correct' : 'incorrect',
    isCorrect,
    answer: question.answer,
  }
}

/**
 * 手書き入力の判定。自動判定は行わず、正解提示後の自己申告をそのまま結果にする。
 */
export function judgeHandwriting(question: Question, didRecall: boolean): JudgeResult {
  return {
    verdict: didRecall ? 'self-correct' : 'self-incorrect',
    isCorrect: didRecall,
    answer: question.answer,
  }
}

/**
 * assemble モードの判定。
 *
 * 2つの部品を、置いた枠のとおりに照合する(first = 左または上)。
 * 割れる向きと先にくる部品は assemble の表で持っているので、
 * 「どちらに置いたか」まで正解に含められる(位 を 立亻 と組んだら不正解)。
 */
export function judgeParts(question: Question, first: string, second: string): JudgeResult {
  const assembly = assemblyOf(question)
  const isCorrect = assembly !== null && first === assembly.first && second === assembly.second

  return {
    verdict: isCorrect ? 'correct' : 'incorrect',
    isCorrect,
    answer: question.answer,
  }
}
