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
 * 筆算する(小5の教科書の手順)。わられる数には小数点が残ることがある(2.56 ÷ 0.8 → 25.6 ÷ 8)。
 * 整数のわり算や、わる数が整数の式はそのまま返す。
 */
export function shiftedDivision(expression: Expression): Expression & { shift: number } {
  const shift = decimalPlaces(expression.right)
  if (expression.operator !== '÷' || shift === 0) return { ...expression, shift: 0 }
  return {
    left: movePoint(expression.left, shift),
    operator: '÷',
    right: movePoint(expression.right, shift),
    shift,
  }
}

/**
 * 小数点を右へ動かす。数に直してから掛けると 2.56 × 10 が 25.600000000000001 のようにずれるので、
 * 文字のまま動かす(足りないけたは 0 で埋める。0.8 を1けた → 8)。
 */
function movePoint(number: string, places: number): string {
  const [whole, fraction = ''] = number.split('.')
  const padded = fraction.padEnd(places, '0')
  const moved = String(Number(whole + padded.slice(0, places)))
  const rest = padded.slice(places)
  return rest ? `${moved}.${rest}` : moved
}
