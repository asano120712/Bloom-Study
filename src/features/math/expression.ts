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
  const parsed = text.match(/^(\d+(?:\.\d+)?)\s*([×÷+\-−])\s*(\d+(?:\.\d+)?)$/)
  if (!parsed) return null
  return { left: parsed[1], operator: parsed[2], right: parsed[3] }
}

/** 小数点より下のけた数(「2.45」なら 2、整数なら 0) */
export function decimalPlaces(number: string): number {
  const point = number.indexOf('.')
  return point === -1 ? 0 : number.length - point - 1
}

/** 小数点を外した数字だけ(「2.4」→「24」、「0.8」→「8」) */
export function withoutPoint(number: string): string {
  return String(Number(number.replace('.', '')))
}

/**
 * 小数のわり算を、わる数が整数になるように小数点を動かした式にする。
 *
 * 8.4 ÷ 1.2 は、わる数とわられる数の小数点を同じだけ(1けた)右へ動かして 84 ÷ 12 にしてから
 * 筆算する(小5の教科書の手順)。わられる数に小数点が残る問題はまだ出さない(商が小数になる)。
 * 整数のわり算や、小数でない式はそのまま返す。
 */
export function shiftedDivision(expression: Expression): Expression & { shift: number } {
  const shift = decimalPlaces(expression.right)
  if (expression.operator !== '÷' || (shift === 0 && decimalPlaces(expression.left) === 0)) {
    return { ...expression, shift: 0 }
  }
  const scale = 10 ** shift
  return {
    left: String(Math.round(Number(expression.left) * scale)),
    operator: '÷',
    right: String(Math.round(Number(expression.right) * scale)),
    shift,
  }
}
