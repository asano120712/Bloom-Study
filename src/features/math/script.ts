import { parseExpression } from './expression'

/**
 * 筆算の、打つ場所。
 *
 * - `row`     段(かけ算の部分積)。右から何桁ずらすかを持つ
 * - `place`   答えの1けた(たし算・ひき算)。一のくらいから左へ進む
 * - `quotient`わり算の商の1けた。割られる数の何桁目の上かを持つ
 * - `product` わり算の引く段(かける)
 * - `rest`    わり算のひいた数(つぎの桁をおろしたものを含む)
 * - `answer`  最後の答え
 */
export type ColumnSlot =
  | { kind: 'row'; shift: number }
  | { kind: 'place'; place: number }
  | { kind: 'quotient'; column: number }
  | { kind: 'product'; column: number }
  | { kind: 'rest'; column: number }
  | { kind: 'answer' }

export interface ColumnStep {
  /** その場所に入る正しい数 */
  expected: string
  /** 打っている間に式の上に出す見出し(「一のくらい」「7 × 8 を かく」) */
  caption: string
  slot: ColumnSlot
  /**
   * 答えの一部かどうか。
   *
   * 正誤として記録するのは答えの部分だけ。引く段やひいた数は、
   * その場で直して見せるためのもので、点数には入れない
   * (紙の筆算でも、途中の書き間違いは消して直すだけ)。
   */
  counts: boolean
}

const PLACE_NAMES = ['一', '十', '百', '千']

function placeName(place: number): string {
  return `${PLACE_NAMES[place] ?? String(place + 1)}のくらい`
}

/**
 * 筆算の手順を、打つ順に組み立てる。
 *
 * 式だけから組み立てる。問題データに持たせないのは、**手順が式で決まる**ため。
 * データに書くと、式と手順が食い違ったまま出てしまうことがある。
 *
 * 空の配列を返したときは、答えをまとめて打つ(小1・2の1行の式)。
 */
export function columnScript(expression: string): ColumnStep[] {
  const parsed = parseExpression(expression)
  if (!parsed) return []

  const { left, operator, right } = parsed
  if (operator === '×') return multiplySteps(left, right)
  if (operator === '÷') return divideSteps(left, right)
  return addSteps(left, right, operator === '+' ? '+' : '−')
}

/**
 * かけ算の段。
 *
 * かける数が1桁のときは、**かけられる数の位ごと**に段を作る(98 × 7 なら 56 と 63)。
 * 紙の筆算では1段で書ききる形だが、くり上がりを頭で持ったまま書くことになる。
 * 位ごとに分けて書けば、頭に残すものが無くなり、手順がそのまま目に見える。
 *
 * かける数が2桁のときは、紙と同じく**かける数の位ごと**に段を作る(23 × 14 なら 92 と 23)。
 * どちらも「2だんめは1けたずらす」は同じ。
 */
function multiplySteps(left: string, right: string): ColumnStep[] {
  const a = Number(left)
  const b = Number(right)
  const digits = right.length === 1 ? [...left].reverse() : [...right].reverse()
  const other = right.length === 1 ? b : a

  const steps = digits.map((digit, index) => ({
    expected: String(Number(digit) * other),
    caption: `${index + 1}だんめ ${placeName(index)}`,
    slot: { kind: 'row', shift: index } as const,
    counts: false,
  }))

  return [
    ...steps,
    { expected: String(a * b), caption: 'こたえ', slot: { kind: 'answer' }, counts: true },
  ]
}

/**
 * たし算・ひき算は、一のくらいから1けたずつ。段は増えない。
 *
 * 紙の筆算で手が止まるのは「くり上がりを足し忘れる」「くり下がりを引き忘れる」ところなので、
 * 位ごとに区切って打たせると、どの位でつまずいたかがその場で分かる。
 *
 * いちばん上の位だけは2桁になることがある(くり上がった1をそのまま書く)ので、
 * その位の計算の答えをまるごと打つ。
 */
function addSteps(left: string, right: string, operator: '+' | '−'): ColumnStep[] {
  const columns = Math.max(left.length, right.length)
  const digitAt = (text: string, place: number) => Number(text[text.length - 1 - place] ?? '0')

  const steps: ColumnStep[] = []
  let carry = 0
  for (let place = 0; place < columns; place += 1) {
    const a = digitAt(left, place)
    const b = digitAt(right, place)
    const isTop = place === columns - 1

    if (operator === '+') {
      const sum = a + b + carry
      steps.push({
        expected: isTop ? String(sum) : String(sum % 10),
        caption: placeName(place),
        slot: { kind: 'place', place },
        counts: true,
      })
      carry = Math.floor(sum / 10)
    } else {
      const difference = a - b - carry
      steps.push({
        expected: String(difference < 0 ? difference + 10 : difference),
        caption: placeName(place),
        slot: { kind: 'place', place },
        counts: true,
      })
      carry = difference < 0 ? 1 : 0
    }
  }
  return steps
}

/**
 * わり算の筆算(長除法)。1けたごとに「たてる → かける → ひく(おろす)」を打つ。
 *
 * 商だけ打たせると、頭の中で引き算を済ませることになり、紙でやる手順と離れる。
 * ひいた数まで打たせると、どの桁でつまずいたかが分かる。
 *
 * ひいた数は**つぎの桁をおろしたところまで**を1つの数として打つ
 * (588 ÷ 7 で 58 − 56 = 2 のあと 8 をおろして 28)。紙でも、おろした数は
 * ひいた数の右に並べて書き、そのまま次のわり算の相手になる。
 */
function divideSteps(dividend: string, divisor: string): ColumnStep[] {
  const by = Number(divisor)
  const steps: ColumnStep[] = []
  let partial = 0
  let started = false

  for (let column = 0; column < dividend.length; column += 1) {
    partial = partial * 10 + Number(dividend[column])
    const quotient = Math.floor(partial / by)
    // 先頭のうち、まだ商が立たない桁は飛ばす(588 ÷ 7 の 5 の上には書かない)
    if (quotient === 0 && !started) continue
    started = true

    const product = quotient * by
    const rest = partial - product
    const isLast = column === dividend.length - 1

    steps.push({
      expected: String(quotient),
      caption: `しょうの ${placeName(dividend.length - 1 - column)}`,
      slot: { kind: 'quotient', column },
      counts: true,
    })
    steps.push({
      expected: String(product),
      caption: `${divisor} × ${quotient} を かく`,
      slot: { kind: 'product', column },
      counts: false,
    })
    steps.push({
      // おろした桁まで含めた数。最後の桁ではおろすものが無いので、ひいた数だけ
      expected: String(isLast ? rest : rest * 10 + Number(dividend[column + 1])),
      caption: isLast ? 'ひく' : 'ひいて つぎを おろす',
      slot: { kind: 'rest', column: isLast ? column : column + 1 },
      counts: false,
    })

    partial = rest
  }

  return steps
}

/** 打った途中の数から、答えを組み立てる。答えの部分だけを順に拾う */
export function answerFromSteps(script: ColumnStep[], typed: string[]): string {
  const parts = script
    .map((step, index) => ({ step, value: typed[index] ?? '' }))
    .filter(({ step }) => step.counts)

  // たし算・ひき算は一のくらいから打つので、並べ直す
  if (parts.some(({ step }) => step.slot.kind === 'place')) {
    return parts
      .map(({ value }) => value)
      .reverse()
      .join('')
  }
  // かけ算は最後の1つが答えそのもの
  if (parts.length === 1) return parts[0].value
  // わり算は商を上の位から並べる
  return parts.map(({ value }) => value).join('')
}
