import { guessLetter, type Guess } from './index'

/**
 * 1枚のキャンバスに書いた英単語を読む(試し場で、どれくらい読めるかを測るため)。
 *
 * 1字ずつのモデル(guessLetter)しか無いので、まず**線を文字ごとに分ける**。
 * 画素で切ると、隣の字と少し重なっただけで切れなくなるので、書いた線(ストローク)の
 * 横の広がりで分ける。1本の線で何文字も続けて書く(筆記体のようにつなぐ)と分けられない。
 *
 * 分け方は2通り持つ。
 * - segment: 答えを知らずに、線のすき間だけで分ける(そのまま読むとき)
 * - 答えに合わせる: 線のまとめ方を全部試し、答えの各文字にいちばんよく見える分け方を選ぶ。
 *   k や h の縦線と2本目のように、すき間だけでは同じ字か隣の字か決まらないものも、
 *   「l と c の2文字」より「k の1文字」のほうが答えに合うので、自然にまとまる
 */

export interface Point {
  x: number
  y: number
}
export type Stroke = Point[]

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
/** 1字を描き直すマスの大きさと線の太さ。本番のマス(BoxHandwriting)と同じにして、学習時の字と揃える */
const CELL = 120
const LINE_WIDTH = 6

/**
 * つなぐすき間の目安(字の高さに対する割合)。
 *
 * 試し場で書いた 55 語で測ると、0 倍(重なったときだけつなぐ)では 35 語、0.1 倍で 46 語の
 * 文字の数が合った。0.15 倍より広いと、隣の字までつながり始める。
 * 字の中のすき間(k や h の2本目)と字の間のすき間は分布が重なるので、これだけでは決めきれない。
 */
const JOIN_GAP = 0.1
/** 答えに合わせて分けるとき、1字にまとめてよい線の数(k や E でも3本まで) */
const MAX_STROKES_PER_LETTER = 4

/**
 * 次の行に移ったと見なす動き(字の高さに対する割合)。
 * 大きな線(高さが字の BIG 倍以上)が、それまでの右端より BACK 倍以上左から書き始め、
 * 行の真ん中より DOWN 倍以上下がったとき。
 *
 * 縦の位置だけで行を分けると、右端に入りきらず少し下に続けた字(背の高い t など)は
 * 1行めと縦の広がりが重なって分けられず、j の点のように浮いた線は別の行にされた。
 * 書いた順を使うと、i の点を後から打つ(小さい線)のも、t の横棒を最後にまとめて
 * 引く(左へ戻るが下がらない)のも、同じ行のままになる。
 * 行の真ん中も大きな線だけで出す(点まで平均すると上にずれ、次の字が下がって見える)。
 * 試し場で書いた 119 語では、折り返して書いた1語だけが2行になった。
 */
const NEW_LINE_BACK = 0.5
const NEW_LINE_DOWN = 0.8
const NEW_LINE_BIG = 0.5

interface Span {
  stroke: Stroke
  left: number
  right: number
  top: number
  bottom: number
  height: number
  /** 何行め(0 から)。右端に入りきらず下に続けて書いたとき、2行めになる */
  line: number
}

/**
 * 線を「上の行から、行の中は左端の順」に並べる。字の高さの目安(線の高さの中央値)も一緒に返す。
 * strokes は書いた順のまま渡すこと(行の分け目を、書いた順で見つけるため)。
 */
function spansOf(strokes: Stroke[]): { spans: Span[]; height: number } {
  const spans: Span[] = strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => {
      const xs = stroke.map((point) => point.x)
      const ys = stroke.map((point) => point.y)
      const top = Math.min(...ys)
      const bottom = Math.max(...ys)
      return { stroke, left: Math.min(...xs), right: Math.max(...xs), top, bottom, height: bottom - top, line: 0 }
    })
  const heights = spans.map((span) => span.height).sort((a, b) => a - b)
  const height = heights[Math.floor(heights.length / 2)] ?? 0

  let line = 0
  let right = Number.NEGATIVE_INFINITY
  let centers: number[] = []
  for (const span of spans) {
    const center = (span.top + span.bottom) / 2
    const big = span.height >= height * NEW_LINE_BIG
    const middle = centers.reduce((sum, value) => sum + value, 0) / centers.length
    if (big && centers.length && span.left < right - height * NEW_LINE_BACK && center > middle + height * NEW_LINE_DOWN) {
      line += 1
      right = Number.NEGATIVE_INFINITY
      centers = []
    }
    span.line = line
    right = Math.max(right, span.right)
    if (big) centers.push(center)
  }

  spans.sort((a, b) => a.line - b.line || a.left - b.left)
  return { spans, height }
}

/**
 * 答えを知らずに、線を左から順に文字ごとにまとめる。
 * 前の字の右端とのすき間が、字の高さの JOIN_GAP 倍より狭ければ同じ字とみなす。
 */
export function segment(strokes: Stroke[]): Stroke[][] {
  const { spans, height } = spansOf(strokes)
  const groups: { strokes: Stroke[]; right: number; line: number }[] = []
  for (const span of spans) {
    const last = groups.at(-1)
    // 行が変わったら、すき間に関係なく新しい字
    if (last && last.line === span.line && span.left - last.right <= height * JOIN_GAP) {
      last.strokes.push(span.stroke)
      last.right = Math.max(last.right, span.right)
    } else {
      groups.push({ strokes: [span.stroke], right: span.right, line: span.line })
    }
  }
  return groups.map((group) => group.strokes)
}

/**
 * 1字ぶんの線を、マス1つに描き直す。
 * 切り抜くのではなく描き直すのは、線の太さを学習時のマスと揃えるため
 * (大きく書いても小さく書いても、マスの中では同じ太さの線になる)。
 */
export function render(group: Stroke[]): ImageData {
  const points = group.flat()
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const width = Math.max(...points.map((point) => point.x)) - left
  const height = Math.max(...points.map((point) => point.y)) - top
  const margin = LINE_WIDTH * 2
  const scale = (CELL - margin * 2) / Math.max(width, height, 1)
  // 細長い字(l や i)が横に引き伸ばされないよう、縦横とも同じ倍率で真ん中に置く
  const offsetX = (CELL - width * scale) / 2
  const offsetY = (CELL - height * scale) / 2

  const canvas = document.createElement('canvas')
  canvas.width = CELL
  canvas.height = CELL
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return new ImageData(CELL, CELL)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = LINE_WIDTH
  context.strokeStyle = '#000000'
  for (const stroke of group) {
    context.beginPath()
    stroke.forEach((point, index) => {
      const x = (point.x - left) * scale + offsetX
      const y = (point.y - top) * scale + offsetY
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    // 点(1か所を押しただけ)も見えるように、長さ0の線を引く
    if (stroke.length === 1) context.lineTo((stroke[0].x - left) * scale + offsetX + 0.1, (stroke[0].y - top) * scale + offsetY)
    context.stroke()
  }
  return context.getImageData(0, 0, CELL, CELL)
}

export interface WordReading {
  /** 答えを知らずに分けた文字(segment) */
  groups: Stroke[][]
  /** 文字ごとの読み取り(確からしい順に全部) */
  letters: Guess[][]
  /** 文字ごとの1位をつないだもの(答えを使わずに読んだ結果) */
  text: string
  /** 答えに合わせて分けた文字。線が答えの文字数より少ない(つなげて書いた)ときは null */
  aligned: Stroke[][] | null
  /** 答えに合わせて分けたときの、答えの各文字に見える確からしさ */
  expected: { letter: string; score: number; rank: number }[] | null
  /** 単語の候補(文字の数が同じ単語の中で、近い順) */
  words: { word: string; score: number }[]
}

/**
 * 書いた単語を読む。answer は出題の答え、lexicon は出てくる可能性のある単語(問題の答えなど)。
 */
export async function readWord(strokes: Stroke[], answer: string, lexicon: string[]): Promise<WordReading> {
  const groups = segment(strokes)
  const letters: Guess[][] = []
  for (const group of groups) letters.push(await guessLetter(render(group), LETTERS))

  const text = letters.map((guesses) => guesses[0]?.label ?? '?').join('')

  const best = await alignToAnswer(strokes, answer)

  // 単語の確からしさ = 各文字の確からしさの積(対数の和で比べる)
  const scoreOf = (word: string) =>
    [...word].reduce((sum, letter, index) => {
      const found = letters[index].find((guess) => guess.label === letter)
      return sum + Math.log(Math.max(found?.score ?? 0, 1e-6))
    }, 0)
  const words = [...new Set(lexicon)]
    .filter((word) => word.length === letters.length)
    .map((word) => ({ word, score: Math.exp(scoreOf(word)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return { groups, letters, text, aligned: best?.groups ?? null, expected: best?.expected ?? null, words }
}

/**
 * 線を答えの文字数にまとめる分け方のうち、答えの各文字にいちばんよく見えるものを選ぶ。
 *
 * 線を左端の順に並べ、続いた線を1字にまとめる分け方を全部比べる(動的計画法)。
 * 良さは「答えの各文字の確からしさの対数の和」。同じ線のまとまりは何度も出てくるので、
 * 読み取りは1回ずつに留める(10文字・15本でも、読むのは数十回)。
 *
 * 答えに合わせて分けるので、合っている字を書いていればうまく分かれる。
 * 違う字を書いていれば、どう分けても答えの字には見えないので確からしさは低いまま。
 */
async function alignToAnswer(
  strokes: Stroke[],
  answer: string,
): Promise<{ groups: Stroke[][]; expected: { letter: string; score: number; rank: number }[] } | null> {
  const { spans } = spansOf(strokes)
  const units = spans.length
  const letters = answer.length
  if (units < letters) return null

  const read = new Map<string, Guess[]>()
  const guessesOf = async (from: number, to: number) => {
    const key = `${from}-${to}`
    let found = read.get(key)
    if (!found) {
      found = await guessLetter(render(spans.slice(from, to).map((span) => span.stroke)), LETTERS)
      read.set(key, found)
    }
    return found
  }
  const scoreOf = (guesses: Guess[], letter: string) =>
    Math.log(Math.max(guesses.find((guess) => guess.label === letter)?.score ?? 0, 1e-6))

  // best[k][i] = 線 i 本で k 文字を作ったときの、いちばん良い値と、最後の字の始まり
  const best: { value: number; from: number }[][] = Array.from({ length: letters + 1 }, () =>
    Array.from({ length: units + 1 }, () => ({ value: Number.NEGATIVE_INFINITY, from: -1 })),
  )
  best[0][0] = { value: 0, from: -1 }
  for (let k = 1; k <= letters; k += 1) {
    for (let i = k; i <= units - (letters - k); i += 1) {
      for (let from = Math.max(k - 1, i - MAX_STROKES_PER_LETTER); from < i; from += 1) {
        if (best[k - 1][from].value === Number.NEGATIVE_INFINITY) continue
        // 1字は行をまたがない
        if (spans[from].line !== spans[i - 1].line) continue
        const value = best[k - 1][from].value + scoreOf(await guessesOf(from, i), answer[k - 1])
        if (value > best[k][i].value) best[k][i] = { value, from }
      }
    }
  }
  if (best[letters][units].value === Number.NEGATIVE_INFINITY) return null

  // 後ろからたどって、分け方を取り出す
  const cuts: [number, number][] = []
  for (let k = letters, i = units; k > 0; k -= 1) {
    const from = best[k][i].from
    cuts.unshift([from, i])
    i = from
  }
  const groups = cuts.map(([from, to]) => spans.slice(from, to).map((span) => span.stroke))
  const expected = await Promise.all(
    cuts.map(async ([from, to], index) => {
      const guesses = await guessesOf(from, to)
      const rank = guesses.findIndex((guess) => guess.label === answer[index])
      return { letter: answer[index], score: guesses[rank]?.score ?? 0, rank: rank + 1 }
    }),
  )
  return { groups, expected }
}
