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
