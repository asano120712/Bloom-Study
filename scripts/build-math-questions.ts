/**
 * 数学ジャンルの問題を、ルールから生成する。
 *
 * 英単語・漢字と違って**辞書が要らない**。7×8 が 56 であることは外から持ってこなくても
 * 作れるので、このスクリプトは何も読まずに書き出す。
 *
 * それでも実行時ではなく開発時に作って JSON をコミットするのは、
 * 出題セットの保存(sessionStorage)も記録(マイページ)も questionId が変わらないことを
 * 前提にしているため。実行時に作ると「きのう間違えた問題」を指せない。
 *
 * 使い方:
 *   npm run questions:math
 *   npm run questions:math -- --report   # 書き出さず、内訳と先頭20問だけ確認
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Level } from './difficulty.ts'

const OUT_PATH = fileURLToPath(new URL('../src/data/questions.math.generated.json', import.meta.url))

/** 種類ごとの問題数。多すぎても全部は解かれないので、ほどほどに */
const PER_KIND = 400

/**
 * 種を決めた乱数(mulberry32)。
 *
 * 書き出すたびに中身が入れ替わると、差分が読めず問題の入れ替わりにも気づけない。
 * 同じ種からは必ず同じ問題集ができるようにする。
 */
function randomFrom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/*
 * ひき算の記号は、ハイフン(-)ではなくマイナス記号(−, U+2212)を使う。
 * 筆算で縦に積むと、ハイフンは短くて位置も低く、記号に見えない。
 */
const random = randomFrom(20261005)
const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

interface MathQuestion {
  id: string
  genreId: 'math'
  prompt: string
  /**
   * 式の見せ方。'column' は筆算(縦に積んで桁をそろえる)。
   *
   * 2桁以上のかけ算を1行で出すと暗算に近くなり、小3・4には難しい。
   * 筆算はこの学年で習う形なので、縦に積んで出すほうが解きやすく、
   * 位をそろえる練習にもなる。たし算・ひき算の3桁も同じ。
   *
   * わり算は形が違う(割る数 │ 割られる数 で囲い、商を上に書く)ので 'division'。
   */
  promptLayout?: 'column' | 'division' | 'fraction'
  answer: string
  /** 正解と同じに扱う書き方(仮分数の答えに対する帯分数など) */
  acceptableAnswers?: string[]
  /** 解き方の途中式(分数だけ)。結果画面のおてほんで、答えまでの道すじとして見せる */
  work?: string
  level: Level
  /**
   * 計算の種類。出題の前に選んだ種類で絞り込む(src/types の MathTopic と同じ値)。
   * ここは src への依存を作らないよう文字列リテラルで持つ。
   */
  topic: 'add' | 'sub' | 'mul' | 'div' | 'fracAdd' | 'fracMul' | 'decimal'
  hintSource: string[]
}

/**
 * ヒントは「解き方の段取り」を1段ずつ出す。
 *
 * **筆算で出す問題は、筆算の手順をそのままヒントにする。**
 * 一の位から順に計算し、くり上がり・くり下がりを使う、というのが筆算のやり方で、
 * 「24 を 20 と 4 に分ける」は暗算のやり方。画面が筆算なのにヒントが暗算だと、
 * 手が止まる場所とヒントの場所が合わない。
 * 1行で出す小1・2(1桁どうし、2桁±1桁)だけは、さくらんぼ計算のままにする。
 *
 * **最後のヒントまで出ても答えそのものは言わない**(他のジャンルと同じ)。
 *
 * **見出し(`わけかた|` のような前置き)は付けない。** 計算は3つの段取りを
 * 同時に見て足すものなので、3段ぜんぶがヒント枠に収まらないと使えない。
 * 見出しを付けると1段あたり16px増えて、iPhone の幅では最後の段がはみ出す。
 *
 * 分け方も文ではなく式で書く(「320 を 300 と 20 に わける」ではなく「320 = 300 + 20」)。
 * 320px 幅の端末では前者が2行になって、やはり最後の段がはみ出す。
 * 式のほうが短いうえ、他の段と同じ書き方になって読む切り替えも要らない。
 */

/**
 * 2桁 × 1桁。筆算どおり、一の位の積と十の位の積を段に分けて書く。
 * 95 × 8 なら 1だんめ 40(5×8)、2だんめ 72(9×8、1けたずらす)、足して 760。
 */
function multiply2x1(): MathQuestion | null {
  const a = pick(12, 99)
  const b = pick(3, 9)
  if (a % 10 === 0) return null

  const tens = Math.floor(a / 10) * 10
  const ones = a % 10

  return {
    id: `ma-m21-${a}x${b}`,
    genreId: 'math',
    prompt: `${a} × ${b}`,
    promptLayout: 'column',
    answer: String(a * b),
    level: 'g34',
    topic: 'mul',
    hintSource: [
      `1だんめ 一のくらい ${ones} × ${b}`,
      `2だんめ 十のくらい ${tens / 10} × ${b}`,
      `2だんめは 1けた ずらす`,
    ],
  }
}

/** 2桁 × 2桁(小3・4)。段ごとに分けて、下の段は1桁ずらす */
function multiply2x2(): MathQuestion | null {
  return multiplyBy2Digits({ a: [12, 99], b: [12, 49], level: 'g34', idPrefix: 'ma-m22' })
}

/** 3桁 × 2桁(小5・6)。かけ方は 2桁 × 2桁 と同じで、段の数字が1けた長くなる */
function multiply3x2(): MathQuestion | null {
  return multiplyBy2Digits({ a: [102, 987], b: [12, 98], level: 'g56', idPrefix: 'ma-m32' })
}

/** かける数が2桁のかけ算。段は かける数の位ごとに2つ */
function multiplyBy2Digits(range: {
  a: [number, number]
  b: [number, number]
  level: Level
  idPrefix: string
}): MathQuestion | null {
  const a = pick(...range.a)
  const b = pick(...range.b)
  if (a % 10 === 0 || b % 10 === 0) return null

  const tens = Math.floor(b / 10) * 10
  const ones = b % 10

  return {
    id: `${range.idPrefix}-${a}x${b}`,
    genreId: 'math',
    prompt: `${a} × ${b}`,
    promptLayout: 'column',
    // 筆算の段。下の段は1桁ずらして書くので、a × (十の位の数字) をそのまま持つ
    answer: String(a * b),
    level: range.level,
    topic: 'mul',
    hintSource: [
      `1だんめ ${a} × 一のくらいの ${ones}`,
      `2だんめ ${a} × 十のくらいの ${tens / 10}`,
      `2だんめは 1けた ずらす`,
    ],
  }
}

/** わりきれるわり算(小3・4)。1けたでわる */
function divideExact(): MathQuestion | null {
  return divideTwoDigitQuotient({ divisor: [3, 9], level: 'g34', idPrefix: 'ma-d' })
}

/**
 * 2けたでわる わりきれるわり算(小5・6)。
 * 割る数が2けたになると、商の見当をつける(かりの商)のが難しくなる。
 * 立て方・ヒントの段取りは1けたでわるときと同じ。
 */
function divideBy2Digits(): MathQuestion | null {
  return divideTwoDigitQuotient({ divisor: [12, 49], level: 'g56', idPrefix: 'ma-d2' })
}

/** 商が2けたになる、わりきれるわり算。商を十の位と一の位に割って戻す */
function divideTwoDigitQuotient(range: {
  divisor: [number, number]
  level: Level
  idPrefix: string
}): MathQuestion | null {
  const divisor = pick(...range.divisor)
  const quotient = pick(11, 99)
  // 割る数が 20 や 30 だと、かりの商を立てる練習にならない(十の位だけで割れる)
  if (quotient % 10 === 0 || (divisor >= 10 && divisor % 10 === 0)) return null

  const tens = Math.floor(quotient / 10) * 10
  const dividend = divisor * quotient
  // 筆算で最初に立てる位。588 ÷ 7 なら 58、92 ÷ 4 なら 9
  const head = Math.floor(dividend / 10)

  return {
    id: `${range.idPrefix}-${dividend}d${divisor}`,
    genreId: 'math',
    prompt: `${dividend} ÷ ${divisor}`,
    promptLayout: 'division',
    answer: String(quotient),
    level: range.level,
    topic: 'div',
    hintSource: [
      `上から ${head} ÷ ${divisor} で ${tens / 10} たつ`,
      `${divisor} × ${tens / 10} = ${divisor * (tens / 10)} を かいて ひく`,
      `のこり ${head - divisor * (tens / 10)} に ${dividend % 10} を おろす`,
    ],
  }
}

/**
 * くり上がりのあるたし算(小1・2)。いわゆる「さくらんぼ計算」を段取りにする。
 * 8 + 5 なら、5 を 2 と 3 に分けて 8 + 2 で 10 を作る。
 */
function addCarry(): MathQuestion | null {
  const a = pick(3, 9)
  const b = pick(3, 9)
  // くり上がりのない組み合わせは、この段では練習にならない
  if (a + b <= 10) return null

  const toTen = 10 - a
  const rest = b - toTen

  return {
    id: `ma-ac-${a}p${b}`,
    genreId: 'math',
    prompt: `${a} + ${b}`,
    answer: String(a + b),
    level: 'g12',
    topic: 'add',
    hintSource: [`${b} = ${toTen} + ${rest}`, `${a} + ${toTen} = 10`, `10 + ${rest}`],
  }
}

/**
 * くり下がりのあるひき算(小1・2)。
 * 13 - 7 なら、13 を 10 と 3 に分けて 10 - 7 を先に引く。
 */
function subtractBorrow(): MathQuestion | null {
  const a = pick(11, 18)
  const b = pick(3, 9)
  // 一の位だけで引けるならくり下がりが起きない
  if (a % 10 >= b || a - b < 2) return null

  return {
    id: `ma-sb-${a}m${b}`,
    genreId: 'math',
    prompt: `${a} − ${b}`,
    answer: String(a - b),
    level: 'g12',
    topic: 'sub',
    hintSource: [`${a} = 10 + ${a - 10}`, `10 - ${b} = ${10 - b}`, `${10 - b} + ${a - 10}`],
  }
}

/**
 * 2桁 + 1桁でくり上がるもの(小2)。1桁どうしと同じ考え方で、次の10を作る。
 * 27 + 8 なら、8 を 3 と 5 に分けて 27 + 3 で 30 にする。
 */
function addToNextTen(): MathQuestion | null {
  const a = pick(13, 89)
  const b = pick(3, 9)
  if (a % 10 === 0 || a % 10 + b <= 10) return null

  const toTen = 10 - (a % 10)
  const rest = b - toTen
  const ten = a + toTen

  return {
    id: `ma-at-${a}p${b}`,
    genreId: 'math',
    prompt: `${a} + ${b}`,
    answer: String(a + b),
    level: 'g12',
    topic: 'add',
    hintSource: [`${b} = ${toTen} + ${rest}`, `${a} + ${toTen} = ${ten}`, `${ten} + ${rest}`],
  }
}

/**
 * 2桁 - 1桁でくり下がるもの(小2)。十の位から10を借りて引く。
 * 34 - 8 なら、34 を 24 と 10 に分けて 10 - 8 を先に引く。
 */
function subtractFromTen(): MathQuestion | null {
  const a = pick(21, 99)
  const b = pick(3, 9)
  if (a % 10 >= b) return null

  return {
    id: `ma-st-${a}m${b}`,
    genreId: 'math',
    prompt: `${a} − ${b}`,
    answer: String(a - b),
    level: 'g12',
    topic: 'sub',
    hintSource: [`${a} = ${a - 10} + 10`, `10 - ${b} = ${10 - b}`, `${a - 10} + ${10 - b}`],
  }
}

/**
 * 位ごとのヒント。筆算どおり**一の位から**出し、くり上がり・くり下がりも言う。
 *
 * 出すのは一の位と十の位まで。**百の位は出さない**(出すと答えが全桁そろってしまう)。
 * ひき算で「十のくらいは 1 へらす」とだけ言って数を出さないのは、十の位が 0 のときに
 * さらに上から借りることがあり、言い切れないため。
 */
function columnHints(a: number, b: number, operator: '+' | '−'): string[] {
  const [a0, a1] = [a % 10, Math.floor(a / 10) % 10]
  const [b0, b1] = [b % 10, Math.floor(b / 10) % 10]

  if (operator === '+') {
    const ones = a0 + b0
    const carried = ones >= 10
    return [
      `一のくらい ${a0} + ${b0} = ${ones}`,
      carried ? `${ones % 10} をかいて 1 くりあがり` : `くりあがりは なし`,
      `十のくらい ${a1} + ${b1}${carried ? ' + 1' : ''} = ${a1 + b1 + (carried ? 1 : 0)}`,
    ]
  }

  // ひき算は一の位で必ずくり下がるものだけを作っている(下の subtractThreeDigits を参照)
  return [
    `一のくらい ${a0} − ${b0} は ひけない`,
    `10 かりて ${10 + a0} − ${b0} = ${10 + a0 - b0}`,
    `十のくらいは 1 へらして ひく`,
  ]
}

/**
 * 3桁のたし算(小3・4)。筆算で出し、ヒントも筆算どおり一の位から順に出す。
 */
function addThreeDigits(): MathQuestion | null {
  const a = pick(103, 879)
  const b = pick(103, 879)
  // くり上がりが1度も起きない組み合わせは、この段では練習にならない
  if (a % 10 + (b % 10) < 10 && (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) < 10) {
    return null
  }

  return {
    id: `ma-a3-${a}p${b}`,
    genreId: 'math',
    prompt: `${a} + ${b}`,
    promptLayout: 'column',
    answer: String(a + b),
    level: 'g34',
    topic: 'add',
    hintSource: columnHints(a, b, '+'),
  }
}

/** 3桁のひき算(小3・4)。筆算で出し、ヒントも筆算どおり一の位から順に出す */
function subtractThreeDigits(): MathQuestion | null {
  const a = pick(205, 989)
  const b = pick(103, 879)
  if (b >= a - 10) return null
  /*
   * 一の位で必ずくり下がる組み合わせだけにする。
   * くり下がらない問題はこの段の練習にならないうえ、ヒントが
   * 「一のくらいは ひける / 十のくらいは…」と場合分けだらけになる。
   */
  if (a % 10 >= b % 10) return null
  /*
   * いちばん上の位が 0 になる組み合わせも外す(320 − 298 = 022)。
   * 筆算では上の位に 0 を書かないので、位ごとに打たせると打つものが無くなる。
   */
  if (a - b < 100) return null

  return {
    id: `ma-s3-${a}m${b}`,
    genreId: 'math',
    prompt: `${a} − ${b}`,
    promptLayout: 'column',
    answer: String(a - b),
    level: 'g34',
    topic: 'sub',
    hintSource: columnHints(a, b, '−'),
  }
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/**
 * 分数の答えを書く形にする。
 *
 * 約分した仮分数(7/4)を正解にし、1より大きければ帯分数(1 3/4)も同じに扱う。
 * 教科書でもどちらの形も使うので、どちらかにしぼらない。割り切れたら整数(2)。
 * 判定は値と約分を見る(src/features/judge)ので、ここは結果画面で見せる形を決めるだけ。
 */
function fractionAnswer(numerator: number, denominator: number) {
  const common = gcd(numerator, denominator)
  const [top, bottom] = [numerator / common, denominator / common]
  if (bottom === 1) return { answer: String(top), top, bottom }
  return {
    answer: `${top}/${bottom}`,
    acceptableAnswers: top > bottom ? [`${Math.floor(top / bottom)} ${top % bottom}/${bottom}`] : undefined,
    top,
    bottom,
  }
}

/**
 * 途中式の終わり。計算した分数(約分する前)から、約分した答え、帯分数までをつなぐ。
 * 「= 4/6 = 2/3」「= 29/21 = 1 8/21」。約分も帯分数も要らなければ、計算した分数だけ。
 */
function workTail(numerator: number, denominator: number): string {
  const result = fractionAnswer(numerator, denominator)
  const steps = [`${numerator}/${denominator}`]
  if (result.answer !== steps[0]) steps.push(result.answer)
  steps.push(...(result.acceptableAnswers ?? []))
  return steps.join(' = ')
}

/** 約分してある真分数(分子が分母より小さい)を1つ選ぶ */
function properFraction(maxDenominator: number): [number, number] | null {
  const denominator = pick(2, maxDenominator)
  const numerator = pick(1, denominator - 1)
  return gcd(numerator, denominator) === 1 ? [numerator, denominator] : null
}

/**
 * 分母のちがう分数のたし算・ひき算(小5)。通分してから計算する。
 *
 * 通分した分母は 36 まで。それより大きいと、分母をそろえる計算そのものが重くなり、
 * 小5の教科書の範囲から外れる。答えの分子・分母は2けたに収まる(手書きのマスの数)。
 */
function addFractions(): MathQuestion | null {
  const first = properFraction(12)
  const second = properFraction(12)
  if (!first || !second) return null
  const [[a, b], [c, d]] = [first, second]
  if (b === d) return null

  const common = (b * d) / gcd(b, d)
  if (common > 36) return null

  const isAdd = random() < 0.5
  const [left, right] = [a * (common / b), c * (common / d)]
  const total = isAdd ? left + right : left - right
  if (total <= 0) return null
  const result = fractionAnswer(total, common)
  if (result.top > 99 || result.bottom > 99) return null

  const operator = isAdd ? '+' : '−'
  // 通分した形は、分母がもう そろっている側は書かない(「2/12 = 2/12」は手がかりにならない)
  const converted = [
    [a, b, left],
    [c, d, right],
  ]
    .filter(([, denominator]) => denominator !== common)
    .map(([numerator, denominator, scaled]) => `${numerator}/${denominator} = ${scaled}/${common}`)

  return {
    id: `ma-fa-${a}_${b}${isAdd ? 'p' : 'm'}${c}_${d}`,
    genreId: 'math',
    prompt: `${a}/${b} ${operator} ${c}/${d}`,
    promptLayout: 'fraction',
    answer: result.answer,
    acceptableAnswers: result.acceptableAnswers,
    work: `${a}/${b} ${operator} ${c}/${d} = ${left}/${common} ${operator} ${right}/${common} = ${workTail(total, common)}`,
    level: 'g56',
    topic: 'fracAdd',
    hintSource: [
      `分母を ${common} に そろえる`,
      converted.join('、'),
      `分子を ${isAdd ? 'たして' : 'ひいて'}、約分できるか みる`,
    ],
  }
}

/**
 * 分数のかけ算・わり算(小6)。
 * わり算は、わる数の分子と分母を入れかえて(逆数にして)かける。
 */
function multiplyFractions(): MathQuestion | null {
  const first = properFraction(9)
  const second = properFraction(9)
  if (!first || !second) return null
  const [[a, b], [c, d]] = [first, second]

  const isMultiply = random() < 0.5
  const result = isMultiply ? fractionAnswer(a * c, b * d) : fractionAnswer(a * d, b * c)
  if (result.top > 99 || result.bottom > 99 || result.top / result.bottom >= 10) return null

  return {
    id: `ma-fm-${a}_${b}${isMultiply ? 'x' : 'd'}${c}_${d}`,
    genreId: 'math',
    prompt: `${a}/${b} ${isMultiply ? '×' : '÷'} ${c}/${d}`,
    promptLayout: 'fraction',
    answer: result.answer,
    acceptableAnswers: result.acceptableAnswers,
    work: isMultiply
      ? `${a}/${b} × ${c}/${d} = ${workTail(a * c, b * d)}`
      : `${a}/${b} ÷ ${c}/${d} = ${a}/${b} × ${d}/${c} = ${workTail(a * d, b * c)}`,
    level: 'g56',
    topic: 'fracMul',
    hintSource: isMultiply
      ? [`分子は ${a} × ${c}、分母は ${b} × ${d}`, 'かける前に 約分できるところを さがす', 'さいごに 約分できるか みる']
      : [
          // iPhone SE の幅(1行 19字ほど)で折り返さない長さにする。折り返すと3段がヒント枠に入らない
          'わる数を ひっくり返して かける',
          `${a}/${b} × ${d}/${c}`,
          '分子どうし、分母どうしを かける',
        ],
  }
}

/** 小数第1位までの数を、10倍した整数で選ぶ(末尾が 0 の 2.0 や 3.0 は選ばない) */
function tenths(min: number, max: number): number | null {
  const value = pick(min, max)
  return value % 10 === 0 ? null : value
}

/** 10倍・100倍した整数を、小数の文字にする(末尾の 0 は消す。840, 2 → 8.4) */
function decimalText(scaled: number, places: number): string {
  return String(Number((scaled / 10 ** places).toFixed(places)))
}

/**
 * 小数 × 小数(小5)。小数第1位までの数どうし。
 *
 * 筆算は、小数点を無いものとして整数で計算し、答えに小数点を打つ
 * (src/features/math の columnScript)。答えは末尾の 0 を消した形で持つ(8.40 → 8.4)。
 * 判定は数で比べるので、8.40 と書いても正解になる。
 */
function multiplyDecimals(): MathQuestion | null {
  const a = tenths(11, 99)
  const b = tenths(2, 99)
  if (a === null || b === null) return null

  const [left, right] = [decimalText(a, 1), decimalText(b, 1)]
  return {
    id: `ma-dm-${left}x${right}`,
    genreId: 'math',
    prompt: `${left} × ${right}`,
    promptLayout: 'column',
    answer: decimalText(a * b, 2),
    level: 'g56',
    topic: 'decimal',
    // iPhone SE の幅(1行 19字ほど)で折り返さない長さにする。折り返すと3段がヒント枠に入らない
    hintSource: [
      `${a} × ${b} を 整数で 計算する`,
      '小数点より下の けたは あわせて 2けた',
      '右から 2けたの ところに 小数点を うつ',
    ],
  }
}

/**
 * 小数 ÷ 小数(小5)。わる数が整数になるよう、小数点を1けた右に動かしてからわる。
 * 8.4 ÷ 1.2 → 84 ÷ 12。この段階では、商が整数になる(わりきれる)ものだけにする。
 */
function divideDecimals(): MathQuestion | null {
  const divisor = tenths(2, 99)
  const quotient = pick(2, 99)
  if (divisor === null || quotient % 10 === 0) return null

  // 小数点を動かしたあとのわられる数(整数)。もとの式では10で割った小数になる
  const shifted = divisor * quotient
  if (shifted % 10 === 0) return null
  const [dividend, by] = [decimalText(shifted, 1), decimalText(divisor, 1)]

  return {
    id: `ma-dd-${dividend}d${by}`,
    genreId: 'math',
    prompt: `${dividend} ÷ ${by}`,
    promptLayout: 'division',
    answer: String(quotient),
    level: 'g56',
    topic: 'decimal',
    hintSource: [
      'わる数の 小数点を 1けた 右に うつす',
      'わられる数の 小数点も 同じだけ うつす',
      `${shifted} ÷ ${divisor} を 計算する`,
    ],
  }
}

const KINDS: { name: string; make: () => MathQuestion | null }[] = [
  { name: 'くり上がりのたし算(小1・2)', make: addCarry },
  { name: 'くり下がりのひき算(小1・2)', make: subtractBorrow },
  { name: '2桁+1桁のくり上がり(小2)', make: addToNextTen },
  { name: '2桁-1桁のくり下がり(小2)', make: subtractFromTen },
  { name: '3桁のたし算(小3・4)', make: addThreeDigits },
  { name: '3桁のひき算(小3・4)', make: subtractThreeDigits },
  { name: '2桁×1桁', make: multiply2x1 },
  { name: '2桁×2桁', make: multiply2x2 },
  { name: 'わりきれるわり算', make: divideExact },
  // 小5・6。今ある問題が入れ替わらないよう、種類は必ず後ろに足す(同じ種の乱数を順に引くため)
  { name: '3桁×2桁(小5・6)', make: multiply3x2 },
  { name: '2桁でわるわり算(小5・6)', make: divideBy2Digits },
  { name: '分数のたし算・ひき算(小5)', make: addFractions },
  { name: '分数のかけ算・わり算(小6)', make: multiplyFractions },
  { name: '小数のかけ算(小5)', make: multiplyDecimals },
  { name: '小数のわり算(小5)', make: divideDecimals },
]

function main(): void {
  const reportOnly = process.argv.includes('--report')

  const questions: MathQuestion[] = []
  const seen = new Set<string>()

  for (const kind of KINDS) {
    let made = 0
    // 同じ式を2度出さない。作れない組み合わせを引くこともあるので上限を決めて回す
    for (let tries = 0; made < PER_KIND && tries < PER_KIND * 40; tries++) {
      const question = kind.make()
      if (!question || seen.has(question.id)) continue
      seen.add(question.id)
      questions.push(question)
      made++
    }
    console.log(`${kind.name}: ${made}問`)
  }

  console.log(`合計: ${questions.length}問`)

  if (reportOnly) {
    console.log('\n--- 先頭20問 ---')
    for (const q of questions.slice(0, 20)) {
      console.log(`${q.prompt} = ${q.answer}\t${q.hintSource.join(' / ')}`)
    }
    return
  }

  writeFileSync(
    OUT_PATH,
    `${JSON.stringify(
      {
        _source: {
          note: '自動生成。編集しても npm run questions:math で上書きされる',
          generatedAt: new Date().toISOString(),
          note2: '辞書は使わない。種を決めた乱数で作るので、同じ種からは同じ問題集ができる',
        },
        questions,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`\n書き出し: ${OUT_PATH}`)
}

main()
