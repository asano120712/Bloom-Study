import {
  decimalPlaces,
  parseExpression,
  shiftedDivision,
  withoutPoint,
  type Expression,
} from './expression'

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
  /**
   * そこに入りうる**最大の桁数**。打つマスをいくつ出すかに使う。
   *
   * 答えの桁数ではなく上限(5 × 8 でも 1 × 8 でも、一のくらいの段は2マス)。
   * 右づめのまま打たせると、打つたびに前の数字が左へずれて読みにくいので、
   * 先にマスを出しておき、左から順に埋める。上限が見えても答えは分からない。
   */
  width: number
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
  /**
   * 答えに打つ小数点の位置(小数のかけ算の答えだけ)。右から何けたのところに打つか。
   * 「2.4 × 3.5」なら 2(8.40)。手書きで小数点を打つ場所を出すのと、打った数の比べ方に使う。
   */
  decimals?: number
  /**
   * この商のあとに小数点が来る(商が小数になるわり算の、一の位の商)。
   * 商の小数点は、わられる数の小数点の真上にそろえて打つので、位置は決まっている。
   * 商のマスを左からつないで答えにするとき、ここで小数点をはさむ。
   */
  decimalAfter?: boolean
}

/**
 * わり算の筆算で、わられる数として並べる数字。
 *
 * 小数のわり算は、小数点を動かした式(8.4 ÷ 1.2 → 84 ÷ 12)で筆算する。
 * わりきれないときは、わられる数の後ろに 0 を付けたしてわり進む(72 ÷ 16 → 72.0 として 4.5)。
 * 並べる数字・小数点の位置・付けたした 0 の数を、筆算の手順と見た目の両方がここから取る。
 */
export interface LongDivision {
  divisor: string
  /** 並べる数字(小数点は抜き、付けたした 0 も含む) */
  digits: string
  /** 小数点が何けためのあとか(0始まり)。小数点が無ければ -1 */
  pointAfter: number
  /** わり進むために付けたした 0 の数。見た目で、もとの数字と分けて出す */
  appended: number
}

/** 付けたす 0 の上限。小学校の問題は、小数第2位までわり進めばわりきれる */
const MAX_APPENDED = 3

export function longDivisionOf(expression: Expression): LongDivision {
  const shifted = shiftedDivision(expression)
  const [whole, fraction = ''] = shifted.left.split('.')
  const by = Number(shifted.right)
  const base = whole + fraction

  // わりきれるまで 0 を付けたす(付けたしても わりきれない問題は出さない)
  let appended = 0
  while (appended < MAX_APPENDED && Number(base + '0'.repeat(appended)) % by !== 0) appended += 1
  if (Number(base + '0'.repeat(appended)) % by !== 0) appended = 0

  return {
    divisor: shifted.right,
    digits: base + '0'.repeat(appended),
    pointAfter: fraction || appended > 0 ? whole.length - 1 : -1,
    appended,
  }
}

const PLACE_NAMES = ['一', '十', '百', '千']

const DECIMAL_PLACE_NAMES = ['一', '二', '三']

/** 位の名前。0 が一の位、マイナスは小数点より下(-1 が小数第一位) */
function placeName(place: number): string {
  if (place < 0) return `小数第${DECIMAL_PLACE_NAMES[-place - 1] ?? String(-place)}位`
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
  if (operator === '×') return multiplyDecimalSteps(left, right)
  if (operator === '÷') {
    // 小数のわり算は、わる数が整数になるよう小数点を動かしてから筆算する(わり進むときは 0 を付けたす)
    const layout = longDivisionOf(parsed)
    return divideSteps(layout.digits, layout.divisor, layout.pointAfter)
  }
  return addSteps(left, right, operator === '+' ? '+' : '−')
}

/**
 * 小数のかけ算。教科書の手順どおり、**小数点を無いものとして整数で**段を計算し、
 * 答えにだけ小数点を打つ(かける数とかけられる数の、小数点より下のけた数を足した位置)。
 * 2.4 × 3.5 なら 24 × 35 の段(120 と 72)を計算して、840 の右から2けたに打って 8.40。
 * 整数のかけ算は、そのまま整数の段になる。
 */
function multiplyDecimalSteps(left: string, right: string): ColumnStep[] {
  const decimals = decimalPlaces(left) + decimalPlaces(right)
  if (decimals === 0) return multiplySteps(left, right)

  const steps = multiplySteps(withoutPoint(left), withoutPoint(right))
  const answer = steps[steps.length - 1]
  const digits = answer.expected.padStart(decimals + 1, '0')
  return [
    ...steps.slice(0, -1),
    {
      ...answer,
      // 小数点を打った形。末尾の 0 は消さない(8.40)。比べるときは数として見るので 8.4 でもよい
      expected: `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`,
      // 0.6 × 0.3 = 0.18 のように、小数点の前に 0 を書くぶんのマスも要る
      width: Math.max(answer.width, digits.length),
      caption: 'こたえ(小数点を わすれずに)',
      decimals,
    },
  ]
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

  /*
    見出しには、その段で**かける2つの数をそのまま**出す。
    かける数が1桁か2桁かで、位ごとに分けるのがどちらの数かが入れ替わるので、
    「1だんめ 一のくらい」とだけ書くと、どちらの一のくらいなのか読めない
    (19 × 18 の2だんめは 19 × 1 で、19 × 8 ではない)。
  */
  const steps = digits.map((digit, index) => ({
    expected: String(Number(digit) * other),
    // 段に入るいちばん大きい数は、相手の数を9倍したもの
    width: String(other * 9).length,
    caption:
      (right.length === 1 ? `${index + 1}だんめ ${digit} × ${right}` : `${index + 1}だんめ ${left} × ${digit}`) +
      (index > 0 ? `(${index}けた ずらす)` : ''),
    slot: { kind: 'row', shift: index } as const,
    counts: false,
  }))

  return [
    ...steps,
    {
      expected: String(a * b),
      width: left.length + right.length,
      caption: 'こたえ',
      slot: { kind: 'answer' },
      counts: true,
    },
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

    if (operator === '+') {
      const sum = a + b + carry
      steps.push({
        // どの位も1けただけ。10 をこえたぶんは、くり上がりとして左の位に回す
        expected: String(sum % 10),
        width: 1,
        caption: placeName(place),
        slot: { kind: 'place', place },
        counts: true,
      })
      carry = Math.floor(sum / 10)
    } else {
      const difference = a - b - carry
      steps.push({
        expected: String(difference < 0 ? difference + 10 : difference),
        width: 1,
        caption: placeName(place),
        slot: { kind: 'place', place },
        counts: true,
      })
      carry = difference < 0 ? 1 : 0
    }
  }

  /*
    最後にくり上がりが残ったら、**その左の位に1けたで書く**(888 + 239 の 1127 の 1)。
    いちばん上の位で「11」と2けた打たせると、紙の筆算と手の動きが変わってしまう。
    くり上がりは1より大きくならない(9 + 9 + 1 = 19)ので、ここは必ず1けた。
  */
  if (carry > 0) {
    steps.push({
      expected: String(carry),
      width: 1,
      caption: placeName(columns),
      slot: { kind: 'place', place: columns },
      counts: true,
    })
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
function divideSteps(dividend: string, divisor: string, pointAfter = -1): ColumnStep[] {
  const by = Number(divisor)
  const steps: ColumnStep[] = []
  let partial = 0
  let started = false

  for (let column = 0; column < dividend.length; column += 1) {
    partial = partial * 10 + Number(dividend[column])
    const quotient = Math.floor(partial / by)
    // 印は、小数点が実際に来るときだけ付ける(整数のわり算の手順は今までと同じ形のまま)
    const decimalAfter = column === pointAfter && pointAfter < dividend.length - 1 ? true : undefined
    // 先頭のうち、まだ商が立たない桁は飛ばす(588 ÷ 7 の 5 の上には書かない)
    if (quotient === 0 && !started && (pointAfter < 0 || column < pointAfter)) continue
    /*
      ただし小数点より上で商が立たないまま一の位まで来たら、一の位に 0 を書く(0.6 ÷ 0.8 = 0.75 の 0)。
      教科書と同じく、0 を立てた位の「かける・ひく」は書かずに、そのまま次の位をおろす。
    */
    if (quotient === 0 && !started) {
      started = true
      steps.push({
        expected: '0',
        width: 1,
        caption: `たてる ${placeName(pointAfter - column)}`,
        slot: { kind: 'quotient', column },
        counts: true,
        decimalAfter,
      })
      continue
    }
    started = true

    const product = quotient * by
    const rest = partial - product
    const isLast = column === dividend.length - 1

    steps.push({
      expected: String(quotient),
      width: 1,
      // 小4で習う「たてる・かける・ひく・おろす」の言い方に合わせる。
      // どの手をしているのかが見出しだけで分かるようにする
      caption: `たてる ${placeName(pointAfter >= 0 ? pointAfter - column : dividend.length - 1 - column)}`,
      slot: { kind: 'quotient', column },
      counts: true,
      decimalAfter,
    })
    steps.push({
      expected: String(product),
      // 引く段に入るいちばん大きい数は、割る数を9倍したもの
      width: String(by * 9).length,
      caption: `かける ${divisor} × ${quotient}`,
      slot: { kind: 'product', column },
      counts: false,
    })
    steps.push({
      // おろした桁まで含めた数。最後の桁ではおろすものが無いので、ひいた数だけ
      expected: String(isLast ? rest : rest * 10 + Number(dividend[column + 1])),
      // ひいた数は割る数より小さい。つぎの桁をおろすと、その右に1桁増える
      width: isLast ? 1 : String(by * 10 - 1).length,
      caption: isLast ? 'ひく' : 'ひく、つぎを おろす',
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
  // わり算は商を上の位から並べる。商が小数になるときは、一の位の商のあとに小数点をはさむ
  return parts.map(({ step, value }) => (step.decimalAfter ? `${value}.` : value)).join('')
}
