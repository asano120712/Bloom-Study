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
  promptLayout?: 'column' | 'division' | 'fraction' | 'word'
  answer: string
  /** 正解と同じに扱う書き方(仮分数の答えに対する帯分数など) */
  acceptableAnswers?: string[]
  /** 解き方の途中式(分数だけ)。結果画面のおてほんで、答えまでの道すじとして見せる */
  work?: string
  /** 答えのマスの前と後ろに添える言葉(文章題だけ。「時速 □ km」「□ %」) */
  answerPrefix?: string
  answerUnit?: string
  level: Level
  /**
   * 計算の種類。出題の前に選んだ種類で絞り込む(src/types の MathTopic と同じ値)。
   * ここは src への依存を作らないよう文字列リテラルで持つ。
   */
  topic: 'add' | 'sub' | 'mul' | 'div' | 'fracAdd' | 'fracMul' | 'decimal' | 'ratio' | 'speed'
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

/**
 * 小数 ÷ 小数で、商が小数になるもの(小5)。7.2 ÷ 1.6 = 4.5、0.6 ÷ 0.8 = 0.75。
 *
 * わる数は小数第1位まで、商は小数第2位まで。小数点を動かしたあとのわられる数は
 * 小数第1位まで(2.56 ÷ 0.8 → 25.6 ÷ 8)。わりきれないところは 0 を付けたしてわり進む。
 * 筆算の横幅が今の問題と同じくらいに収まるよう、わり進んだあとの数字は5けたまでにする。
 *
 * 商は、一の位の 0 を除いて2けたまで(4.5、0.75、3.2)。3けた(4.45)になると途中の段が6つになり、
 * iPhone SE では手書きのマスが 33px まで小さくなって、指で書けなくなる。
 */
function divideDecimalQuotient(): MathQuestion | null {
  const divisor = tenths(2, 99)
  // 商を100倍した整数。整数の商(100の倍数)は、商が整数のわり算のほうで出している
  const quotient = pick(5, 999)
  if (divisor === null || quotient % 100 === 0) return null
  // 商のけた数(一の位の 0 と、末尾の 0 を除く)。4.5 → 45、0.75 → 75
  if (String(quotient).replace(/0+$/, '').length > 2) return null

  // わられる数を1000倍した整数(わる数の10倍 × 商の100倍)
  const scaled = divisor * quotient
  // 小数点を動かしたあとのわられる数(わられる数 × 10)が、小数第1位までで書けるもの
  if (scaled % 10 !== 0) return null
  const dividend = decimalText(scaled, 3)
  const by = decimalText(divisor, 1)
  // 割られる数が 0.0x のように小さすぎると、筆算の形が教科書から外れる
  if (Number(dividend) < 0.1) return null

  // わり進んだあとの数字の数(小数点を動かした数 + 付けたす 0)
  const shifted = decimalText(scaled, 2)
  const answer = decimalText(quotient, 2)
  const digits = shifted.replace('.', '').replace(/^0+/, '').length + Math.max(0, decimalPlaces(answer) - decimalPlaces(shifted))
  if (digits > 5) return null

  return {
    id: `ma-dq-${dividend}d${by}`,
    genreId: 'math',
    prompt: `${dividend} ÷ ${by}`,
    promptLayout: 'division',
    answer,
    level: 'g56',
    topic: 'decimal',
    // iPhone SE の幅(1行 19字ほど)で折り返さない長さにする
    hintSource: [
      'わる数の 小数点を 1けた 右に うつす',
      '商の 小数点は 真上に うつ',
      'わりきれなければ 0を つけて わり進む',
    ],
  }
}

/** 小数点より下のけた数(「4.5」なら 1) */
function decimalPlaces(number: string): number {
  const point = number.indexOf('.')
  return point === -1 ? 0 : number.length - point - 1
}

/*
 * ここから文章題(割合・速さ)。決まった文の型に数を当てはめて作る。
 *
 * 文は、その学年までに習う漢字で書く(割合は小5、速さは小6)。
 * ヒントは「使う式 → 問題の数の当てはめ方 → 答えにする前のひと手間」の3段で、答えそのものは言わない。
 * iPhone SE の幅(1行 19字ほど)で折り返さない長さにする(折り返すと3段がヒント枠に入らない)。
 */

/** 割合の聞き方。割合そのものを答える問題で、何倍・何%・何割のどれで聞くか */
type RatioForm = 'times' | 'percent' | 'tenth'

/** 割合を、聞き方に合わせた言葉にする(0.75 → 0.75倍 / 75% / 7割) */
function ratioWords(percent: number, form: RatioForm): string {
  if (form === 'percent') return `${percent}%`
  if (form === 'tenth') return `${percent / 10}割`
  return `${decimalText(percent, 2)}倍`
}

/** 割合の場面。もとにする量・くらべる量の言い方と、文の型 */
interface RatioScene {
  id: string
  unit: string
  /** もとにする量の候補 */
  bases: number[]
  /** 割合を求める(くらべる量 ÷ もとにする量)。ask は「何%」など */
  ratio: (base: number, compare: number, ask: string) => string
  /** くらべる量を求める(もとにする量 × 割合) */
  compare: (base: number, ratio: string) => string
  /** もとにする量を求める(くらべる量 ÷ 割合) */
  base: (compare: number, ratio: string) => string
}

const RATIO_SCENES: RatioScene[] = [
  {
    id: 'bus',
    unit: '人',
    bases: [20, 25, 30, 40, 50, 60, 80],
    ratio: (b, c, ask) => `定員 ${b}人の バスに ${c}人 乗っています。乗っている人は 定員の ${ask}ですか。`,
    compare: (b, r) => `定員 ${b}人の バスに、定員の ${r}の 人が 乗っています。乗っているのは 何人ですか。`,
    base: (c, r) => `バスに ${c}人 乗っています。これは 定員の ${r}です。定員は 何人ですか。`,
  },
  {
    id: 'test',
    unit: '問',
    bases: [20, 25, 40, 50],
    ratio: (b, c, ask) => `${b}問の テストで ${c}問 正かいしました。正かいした 問題は 全体の ${ask}ですか。`,
    compare: (b, r) => `${b}問の テストで、全体の ${r}を 正かいしました。正かいしたのは 何問ですか。`,
    base: (c, r) => `テストで ${c}問 正かいしました。これは 全体の ${r}です。問題は 全部で 何問ですか。`,
  },
  {
    id: 'book',
    unit: 'ページ',
    bases: [40, 60, 80, 100, 120, 160, 200],
    ratio: (b, c, ask) => `${b}ページの 本のうち ${c}ページを 読みました。読んだのは 全体の ${ask}ですか。`,
    compare: (b, r) => `${b}ページの 本の ${r}を 読みました。読んだのは 何ページですか。`,
    base: (c, r) => `本を ${c}ページ 読みました。これは 全体の ${r}です。本は 全部で 何ページですか。`,
  },
  {
    id: 'saving',
    unit: '円',
    bases: [200, 400, 500, 600, 800, 1000, 2000],
    ratio: (b, c, ask) => `${b}円 ためる 目ひょうで、${c}円 たまりました。たまったのは 目ひょうの ${ask}ですか。`,
    compare: (b, r) => `${b}円 ためる 目ひょうの ${r}が たまりました。たまったのは 何円ですか。`,
    base: (c, r) => `${c}円 たまりました。これは 目ひょうの ${r}です。目ひょうは 何円ですか。`,
  },
  {
    id: 'field',
    unit: 'm²',
    bases: [40, 50, 80, 100, 200, 300],
    ratio: (b, c, ask) => `${b}m²の 畑のうち ${c}m²に トマトを 植えました。トマトの 畑は 全体の ${ask}ですか。`,
    compare: (b, r) => `${b}m²の 畑の ${r}に トマトを 植えました。トマトの 畑は 何m²ですか。`,
    base: (c, r) => `トマトを ${c}m²に 植えました。これは 畑 全体の ${r}です。畑は 何m²ですか。`,
  },
]

/** 文章題の割合の種類。割合・くらべる量・もとにする量のどれを求めるか */
const RATIO_ASKS = ['ratio', 'compare', 'base'] as const
const RATIO_FORMS: RatioForm[] = ['times', 'percent', 'tenth']

/** 割合の文章題(小5) */
function ratioWordProblem(): MathQuestion | null {
  const scene = RATIO_SCENES[pick(0, RATIO_SCENES.length - 1)]
  const ask = RATIO_ASKS[pick(0, RATIO_ASKS.length - 1)]
  const form = RATIO_FORMS[pick(0, RATIO_FORMS.length - 1)]
  const base = scene.bases[pick(0, scene.bases.length - 1)]
  // 割合は 5% きざみ(何割で聞くときは 10% きざみ)。くらべる量が整数になるものだけ
  const percent = pick(1, 19) * 5
  if (form === 'tenth' && percent % 10 !== 0) return null
  if ((base * percent) % 100 !== 0) return null
  const compare = (base * percent) / 100
  // 「1人 乗っています。これは 定員の 5%」のような、場面として不自然に小さい数は出さない
  if (compare < 2) return null
  const ratio = decimalText(percent, 2)
  const words = ratioWords(percent, form)
  // くらべる量・もとにする量を求めるとき、割合を小数に直すひと手間(何倍で聞くときは もう小数なので要らない)
  const toDecimal = form === 'times' ? '割合は そのまま 使う' : `${words}を 小数で 表す`
  const unit = scene.unit

  const asked =
    ask === 'ratio'
      ? {
          prompt: scene.ratio(base, compare, form === 'percent' ? '何%' : form === 'tenth' ? '何割' : '何倍'),
          answer: form === 'percent' ? String(percent) : form === 'tenth' ? String(percent / 10) : ratio,
          answerUnit: form === 'percent' ? '%' : form === 'tenth' ? '割' : '倍',
          work: `${compare} ÷ ${base} = ${ratio}` + (form === 'times' ? '' : ` → ${words}`),
          hints: [
            '割合 = くらべる量 ÷ もとにする量',
            `もとにする量は ${base}${unit}`,
            form === 'percent' ? '%は 割合を 100倍 した数' : form === 'tenth' ? '割は 割合を 10倍 した数' : '何倍かが 割合',
          ],
        }
      : ask === 'compare'
        ? {
            prompt: scene.compare(base, words),
            answer: String(compare),
            answerUnit: unit,
            work: `${base} × ${ratio} = ${compare}`,
            hints: ['くらべる量 = もとにする量 × 割合', `もとにする量は ${base}${unit}`, toDecimal],
          }
        : {
            prompt: scene.base(compare, words),
            answer: String(base),
            answerUnit: unit,
            work: `${compare} ÷ ${ratio} = ${base}`,
            hints: ['もとにする量 = くらべる量 ÷ 割合', `くらべる量は ${compare}${unit}`, toDecimal],
          }

  return {
    id: `ma-wr-${scene.id}-${ask}-${form}-${base}-${percent}`,
    genreId: 'math',
    prompt: asked.prompt,
    promptLayout: 'word',
    answer: asked.answer,
    answerUnit: asked.answerUnit,
    work: asked.work,
    level: 'g56',
    topic: 'ratio',
    hintSource: asked.hints,
  }
}

/** 速さの場面。何が進むか、速さの種類(時速・分速・秒速)と単位 */
interface SpeedScene {
  id: string
  who: string
  kind: '時速' | '分速' | '秒速'
  distance: string
  time: string
  speeds: number[]
  times: number[]
}

const SPEED_SCENES: SpeedScene[] = [
  { id: 'car', who: '車', kind: '時速', distance: 'km', time: '時間', speeds: [30, 40, 45, 50, 60, 70, 80], times: [2, 3, 4, 5] },
  { id: 'bike', who: '自転車', kind: '時速', distance: 'km', time: '時間', speeds: [10, 12, 15, 16, 18, 20], times: [2, 3, 4] },
  { id: 'train', who: '電車', kind: '時速', distance: 'km', time: '時間', speeds: [60, 75, 80, 90, 100, 120], times: [2, 3, 4] },
  { id: 'walk', who: '人', kind: '分速', distance: 'm', time: '分', speeds: [50, 60, 70, 75, 80], times: [5, 8, 10, 12, 15, 20] },
  { id: 'drone', who: 'ドローン', kind: '秒速', distance: 'm', time: '秒', speeds: [4, 5, 6, 8, 10, 12], times: [10, 15, 20, 25, 30] },
]

/** 速さの文章題(小6)。速さ・道のり・時間のどれかを求める */
function speedWordProblem(): MathQuestion | null {
  const scene = SPEED_SCENES[pick(0, SPEED_SCENES.length - 1)]
  const ask = (['speed', 'distance', 'time'] as const)[pick(0, 2)]
  const speed = scene.speeds[pick(0, scene.speeds.length - 1)]
  const time = scene.times[pick(0, scene.times.length - 1)]
  const distance = speed * time
  const { who, kind, distance: d, time: t } = scene

  const asked =
    ask === 'speed'
      ? {
          prompt: `${distance}${d}の 道のりを ${time}${t}で 進む ${who}の ${kind}は 何${d}ですか。`,
          answer: String(speed),
          answerPrefix: kind,
          answerUnit: d,
          work: `${distance} ÷ ${time} = ${speed}`,
          hints: ['速さ = 道のり ÷ 時間', `道のりは ${distance}${d}`, `時間は ${time}${t}`],
        }
      : ask === 'distance'
        ? {
            prompt: `${kind} ${speed}${d}で 進む ${who}が、${time}${t}で 進む 道のりは 何${d}ですか。`,
            answer: String(distance),
            answerPrefix: undefined,
            answerUnit: d,
            work: `${speed} × ${time} = ${distance}`,
            hints: ['道のり = 速さ × 時間', `速さは ${kind} ${speed}${d}`, `時間は ${time}${t}`],
          }
        : {
            prompt: `${kind} ${speed}${d}で 進む ${who}が、${distance}${d} 進むのに かかる 時間は 何${t}ですか。`,
            answer: String(time),
            answerPrefix: undefined,
            answerUnit: t,
            work: `${distance} ÷ ${speed} = ${time}`,
            hints: ['時間 = 道のり ÷ 速さ', `道のりは ${distance}${d}`, `速さは ${kind} ${speed}${d}`],
          }

  return {
    id: `ma-ws-${scene.id}-${ask}-${speed}-${time}`,
    genreId: 'math',
    prompt: asked.prompt,
    promptLayout: 'word',
    answer: asked.answer,
    answerPrefix: asked.answerPrefix,
    answerUnit: asked.answerUnit,
    work: asked.work,
    level: 'g56',
    topic: 'speed',
    hintSource: asked.hints,
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
  { name: '小数のわり算・商が小数(小5)', make: divideDecimalQuotient },
  { name: '割合の文章題(小5)', make: ratioWordProblem },
  { name: '速さの文章題(小6)', make: speedWordProblem },
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
