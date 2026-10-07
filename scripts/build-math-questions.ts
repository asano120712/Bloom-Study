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
const PER_KIND = 150

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
  promptLayout?: 'column' | 'division'
  /**
   * 筆算の途中の段(部分積)を、上から順に。
   *
   * 23 × 14 なら ['92', '23']。2段目は筆算と同じく1桁ずらして書くので、
   * 230 ではなく 23 で持つ(ずらす幅は何段目かで決まるので、データには持たせない)。
   */
  steps?: string[]
  answer: string
  level: Level
  hintSource: string[]
}

/**
 * ヒントは「解き方の段取り」を1段ずつ出す。
 *
 * **最後のヒントまで出ても答えそのものは言わない**(他のジャンルと同じ)。
 * 24×5 なら 100 と 20 までを出して、足すのは解く側に残す。
 *
 * **見出し(`わけかた|` のような前置き)は付けない。** 計算は3つの段取りを
 * 同時に見て足すものなので、3段ぜんぶがヒント枠に収まらないと使えない。
 * 見出しを付けると1段あたり16px増えて、iPhone の幅では最後の段がはみ出す。
 *
 * 分け方も文ではなく式で書く(「320 を 300 と 20 に わける」ではなく「320 = 300 + 20」)。
 * 320px 幅の端末では前者が2行になって、やはり最後の段がはみ出す。
 * 式のほうが短いうえ、他の段と同じ書き方になって読む切り替えも要らない。
 */

/** 2桁 × 1桁。十の位と一の位に割って掛ける */
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
    hintSource: [
      `${a} = ${tens} + ${ones}`,
      `${tens} × ${b} = ${tens * b}`,
      `${ones} × ${b} = ${ones * b}`,
    ],
  }
}

/** 2桁 × 2桁。かける側を十の位と一の位に割る */
function multiply2x2(): MathQuestion | null {
  const a = pick(12, 99)
  const b = pick(12, 49)
  if (a % 10 === 0 || b % 10 === 0) return null

  const tens = Math.floor(b / 10) * 10
  const ones = b % 10

  return {
    id: `ma-m22-${a}x${b}`,
    genreId: 'math',
    prompt: `${a} × ${b}`,
    promptLayout: 'column',
    // 筆算の段。下の段は1桁ずらして書くので、a × (十の位の数字) をそのまま持つ
    steps: [String(a * ones), String(a * (tens / 10))],
    answer: String(a * b),
    level: 'g34',
    hintSource: [
      `${b} = ${tens} + ${ones}`,
      `${a} × ${tens} = ${a * tens}`,
      `${a} × ${ones} = ${a * ones}`,
    ],
  }
}

/** わりきれるわり算。商を十の位と一の位に割って戻す */
function divideExact(): MathQuestion | null {
  const divisor = pick(3, 9)
  const quotient = pick(11, 99)
  if (quotient % 10 === 0) return null

  const tens = Math.floor(quotient / 10) * 10
  const ones = quotient % 10
  const dividend = divisor * quotient

  return {
    id: `ma-d-${dividend}d${divisor}`,
    genreId: 'math',
    prompt: `${dividend} ÷ ${divisor}`,
    promptLayout: 'division',
    answer: String(quotient),
    level: 'g34',
    hintSource: [
      `${dividend} = ${divisor * tens} + ${divisor * ones}`,
      `${divisor * tens} ÷ ${divisor} = ${tens}`,
      `${divisor * ones} ÷ ${divisor} = ${ones}`,
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
    hintSource: [`${a} = ${a - 10} + 10`, `10 - ${b} = ${10 - b}`, `${a - 10} + ${10 - b}`],
  }
}

/** 位ごとに分けた数。308 なら [300, 0, 8] */
function places(value: number): [number, number, number] {
  return [Math.floor(value / 100) * 100, Math.floor((value % 100) / 10) * 10, value % 10]
}

/**
 * 3桁のたし算(小3・4)。足す数を位ごとに分けて、大きい位から足す。
 * 筆算で書く形で出すので、位をそろえる練習にもなる。
 */
function addThreeDigits(): MathQuestion | null {
  const a = pick(103, 879)
  const b = pick(103, 879)
  // くり上がりが1度も起きない組み合わせは、この段では練習にならない
  if (a % 10 + (b % 10) < 10 && (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) < 10) {
    return null
  }

  const [hundreds, tens] = places(b)

  return {
    id: `ma-a3-${a}p${b}`,
    genreId: 'math',
    prompt: `${a} + ${b}`,
    promptLayout: 'column',
    answer: String(a + b),
    level: 'g34',
    hintSource: [
      `${b} = ${hundreds} + ${tens} + ${b % 10}`,
      `${a} + ${hundreds} = ${a + hundreds}`,
      `${a + hundreds} + ${tens} = ${a + hundreds + tens}`,
    ],
  }
}

/** 3桁のひき算(小3・4)。引く数を位ごとに分けて、大きい位から引く */
function subtractThreeDigits(): MathQuestion | null {
  const a = pick(205, 989)
  const b = pick(103, 879)
  if (b >= a - 10) return null
  // くり下がりが1度も起きない組み合わせは、この段では練習にならない
  if (a % 10 >= b % 10 && Math.floor(a / 10) % 10 >= Math.floor(b / 10) % 10) return null

  const [hundreds, tens] = places(b)

  return {
    id: `ma-s3-${a}m${b}`,
    genreId: 'math',
    prompt: `${a} − ${b}`,
    promptLayout: 'column',
    answer: String(a - b),
    level: 'g34',
    hintSource: [
      `${b} = ${hundreds} + ${tens} + ${b % 10}`,
      `${a} - ${hundreds} = ${a - hundreds}`,
      `${a - hundreds} - ${tens} = ${a - hundreds - tens}`,
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
