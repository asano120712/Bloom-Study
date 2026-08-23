/** 調整可能なゲームパラメータを1か所に集約する。 */

/**
 * ヒントを1段階開放する間隔(ミリ秒)。
 *
 * 英単語は答えの文字数だけ段階があるため、間隔を延ばすと最長の語で
 * 待ち時間が跳ね上がる(10文字なら9段階)。全ジャンル共通で10秒にしている。
 */
export const HINT_INTERVAL_MS = 10_000

/**
 * 無料トライアルで解答できる問題数。正誤に関わらず解答完了で1消化。
 *
 * 現在は未使用(回数制限を設けていない)。制限を戻すときは
 * src/services/quizSource.ts の startSession でこの値を参照して切る。
 */
export const TRIAL_LIMIT = 10

/**
 * レベル2(編集距離)であいまい正解とみなす上限。
 * 短い語で誤判定しないよう、正解の長さに応じて許容量を変える。
 */
export function levenshteinTolerance(answerLength: number): number {
  if (answerLength <= 3) return 0
  if (answerLength <= 6) return 1
  return 2
}
