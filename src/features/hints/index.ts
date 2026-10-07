import type { GenreId, HintLayout, HintRule, HintStep, Question } from '@/types'
import { englishHintRule } from './english'
import { kanjiHintRule } from './kanji'
import { mathHintRule } from './math'

/**
 * ジャンル別ヒント分解ルールのレジストリ。
 * ジャンルを追加するときは、ルールを個別に設計してここに登録する。
 */
const HINT_RULES: Record<GenreId, HintRule> = {
  english: englishHintRule,
  kanji: kanjiHintRule,
  math: mathHintRule,
}

/** ジャンルごとのヒントの並べかた */
export function hintLayoutOf(genreId: GenreId): HintLayout {
  return HINT_RULES[genreId].layout
}

/** 出題語に対する全ヒント段階を生成する */
export function buildHints(question: Question): HintStep[] {
  return HINT_RULES[question.genreId].build(question)
}

/** 経過時間から、現在開放されているヒントだけを取り出す */
export function revealedHints(hints: HintStep[], revealedCount: number): HintStep[] {
  return hints.slice(0, Math.max(0, Math.min(revealedCount, hints.length)))
}
