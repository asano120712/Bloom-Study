import levenshtein from 'fast-levenshtein'
import { levenshteinTolerance } from '@/config'
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
 * 手書き入力の判定。自動判定は行わず、正解提示後の自己申告をそのまま結果にする。
 */
export function judgeHandwriting(question: Question, didRecall: boolean): JudgeResult {
  return {
    verdict: didRecall ? 'self-correct' : 'self-incorrect',
    isCorrect: didRecall,
    answer: question.answer,
  }
}
