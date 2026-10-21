/**
 * 分数の読み取りと比べ方。
 *
 * 答えは文字で持つ(「7/4」「1 3/4」「2」)。比べるときは**分数として**値を出して比べ、
 * そのうえで「約分してあるか」を別に見る。値だけで比べると 4/6 も 2/3 も正解になってしまう
 * (約分は小5で習う手順そのものなので、答えに含める)。
 */

/** 読み取った数。帯分数は whole に整数部分を持つ */
export interface WrittenNumber {
  whole: number
  numerator: number
  denominator: number
  /** 書いた形。約分してあるかの見方が形で変わる */
  form: 'integer' | 'fraction' | 'mixed'
}

const INTEGER = /^(\d+)$/
const FRACTION = /^(\d+)\/(\d+)$/
const MIXED = /^(\d+)\s+(\d+)\/(\d+)$/

/** 「7/4」「1 3/4」「2」を読む。読めない形(小数、0 の分母など)は null */
export function readWrittenNumber(text: string): WrittenNumber | null {
  const value = text.normalize('NFKC').trim().replace(/\s+/g, ' ')

  const integer = INTEGER.exec(value)
  if (integer) return { whole: Number(integer[1]), numerator: 0, denominator: 1, form: 'integer' }

  const fraction = FRACTION.exec(value)
  if (fraction) {
    const [numerator, denominator] = [Number(fraction[1]), Number(fraction[2])]
    if (denominator === 0) return null
    return { whole: 0, numerator, denominator, form: 'fraction' }
  }

  const mixed = MIXED.exec(value)
  if (mixed) {
    const [whole, numerator, denominator] = [Number(mixed[1]), Number(mixed[2]), Number(mixed[3])]
    if (denominator === 0) return null
    return { whole, numerator, denominator, form: 'mixed' }
  }

  return null
}

/** 分数の答えを、整数・分子・分母のマスに分けて持ったもの(打つ・書くときの形) */
export interface FractionValue {
  whole: string
  numerator: string
  denominator: string
}

/** マスに分けて打った・書いた分数を、判定に渡す1行の形(「7/4」「1 3/4」「2」)にする */
export function fractionText({ whole, numerator, denominator }: FractionValue): string {
  if (numerator && denominator) {
    return whole ? `${whole} ${numerator}/${denominator}` : `${numerator}/${denominator}`
  }
  return whole
}

export function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : greatestCommonDivisor(b, a % b)
}

/** 値を「分子 / 分母」の1つの分数に直す(約分はしない) */
function improperOf(number: WrittenNumber): { numerator: number; denominator: number } {
  return {
    numerator: number.whole * number.denominator + number.numerator,
    denominator: number.denominator,
  }
}

export function sameValue(a: WrittenNumber, b: WrittenNumber): boolean {
  const [x, y] = [improperOf(a), improperOf(b)]
  return x.numerator * y.denominator === y.numerator * x.denominator
}

/**
 * これ以上かんたんにできない形か。
 *
 * - 整数はそのまま(「2」)。4/2 のように分数で書いた整数は、まだ約分できる
 * - 分数は、分子と分母に共通の約数が無いこと(4/6 は 2/3 にできる)
 * - 帯分数は、分数の部分が1より小さく、約分してあること(1 6/4 や 1 2/4 はまだ途中)
 *
 * 仮分数(7/4)と帯分数(1 3/4)は、どちらも約分してあれば正解にする。教科書でもどちらも使う。
 */
export function isSimplest(number: WrittenNumber): boolean {
  if (number.form === 'integer') return true
  if (number.numerator === 0) return false
  if (greatestCommonDivisor(number.numerator, number.denominator) !== 1) return false
  if (number.denominator === 1) return false
  if (number.form === 'mixed') return number.whole > 0 && number.numerator < number.denominator
  return true
}

/** 式の中の分数・帯分数を見つける。見せる側(分子を上・分母を下に積む)が使う */
export const FRACTION_IN_TEXT = /(\d+)\s(\d+)\/(\d+)|(\d+)\/(\d+)/g
