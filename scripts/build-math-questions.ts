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

const random = randomFrom(20261005)
const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

interface MathQuestion {
  id: string
  genreId: 'math'
  prompt: string
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
    answer: String(quotient),
    level: 'g34',
    hintSource: [
      `${dividend} = ${divisor * tens} + ${divisor * ones}`,
      `${divisor * tens} ÷ ${divisor} = ${tens}`,
      `${divisor * ones} ÷ ${divisor} = ${ones}`,
    ],
  }
}

const KINDS: { name: string; make: () => MathQuestion | null }[] = [
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
