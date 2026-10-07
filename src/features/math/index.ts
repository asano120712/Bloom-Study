/**
 * 計算ジャンルの、式の読み取り。
 *
 * 問題データは1行の式のまま持っている(「24 × 5」)。マイページの履歴や読み上げは
 * 1行のほうが扱いやすいため、筆算に組み直すのは見せる側の仕事になる。
 * その組み直しに要る読み取りをここにまとめる。
 */
export interface Expression {
  left: string
  operator: string
  right: string
}

export function parseExpression(text: string): Expression | null {
  const parsed = text.match(/^(\d+)\s*([×÷+\-−])\s*(\d+)$/)
  if (!parsed) return null
  return { left: parsed[1], operator: parsed[2], right: parsed[3] }
}

/**
 * 筆算で答えを書くマスの数。
 *
 * **答えの桁数ではなく、入りうる最大の桁数**を返す(95 × 8 なら3、23 × 14 なら4)。
 * 紙のマス目と同じで、上限が見えても答えの桁数は分からない。
 * 答えが短ければ右に寄せて書く。
 */
export function answerBoxCount(text: string): number {
  const expression = parseExpression(text)
  if (!expression) return 4

  const { left, operator, right } = expression
  if (operator === '×') return left.length + right.length
  if (operator === '÷') return Math.max(1, left.length - right.length + 1)
  if (operator === '+') return Math.max(left.length, right.length) + 1
  return left.length
}
