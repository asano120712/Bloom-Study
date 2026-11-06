/**
 * 漢字のパズル(部位に分かれたパーツから選んで漢字を作る)の問題を生成する。
 *
 * 部品は、文字(フォント)ではなく KanjiVG のお手本の線で描く。
 * フォントに無い部品(𠦝・㑒)も出せ、その漢字の中での形のまま出せる(価 の右は 覀 という名前だが、見た目は 西 に近い)。
 * 線と分け方は scripts/build-kanji-shapes.ts が書き出したもの(shapes.kanji.generated.json の characters と splits)を使う。
 *
 * - 正解: 答えの漢字の、左(上)と右(下)の部品
 * - ハズレ: 似た漢字(shapes の similar)のうち、同じ分かれ方の字の部品。正解と同じ名前の部品や、
 *   名前が無くても形がほとんど同じ部品は除く(偽 に対する 偏 の 亻 は、正解と見分けがつかない)
 *
 * タイルの名前は「字|0」(左か上)・「字|1」(右か下)。
 *
 * 使い方:
 *   npm run shapes:kanji      # 先に(分け方を含むお手本を作る)
 *   npm run puzzles:kanji
 *   npm run puzzles:kanji -- --report   # 書き出さず、内訳と例だけ確認
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SHAPES = fileURLToPath(new URL('../src/data/shapes.kanji.generated.json', import.meta.url))
const QUESTIONS = fileURLToPath(new URL('../src/data/questions.kanji.generated.json', import.meta.url))
const OUT = fileURLToPath(new URL('../src/data/puzzles.kanji.generated.json', import.meta.url))

/** 並べるタイルの数(正解2つ + ハズレ)。今のパズル(PartsInput のトレイ)と同じ */
const TILE_COUNT = 8
/** ハズレがこれより少ない字は、パズルにしない(選ぶまでもなく分かってしまう) */
const MIN_DECOYS = 4
/**
 * 形がほとんど同じとみなす近さ(部品を一辺 1 に収めたときの、点どうしの平均距離)。
 * 名前の付いていない部品どうしを見分けるのに使う(名前があれば名前で見分ける)
 */
const SAME_SHAPE = Number(process.env.SAME_SHAPE ?? 0.05)

interface Split {
  layout: 'horizontal' | 'vertical'
  first: number[]
  names: [string, string]
}
interface Shapes {
  characters: Record<string, number[][]>
  splits: Record<string, Split>
  similar: Record<string, string[]>
  /** 小1・小2の漢字 */
  low: string[]
}

type Point = [number, number]

const shapes = JSON.parse(readFileSync(SHAPES, 'utf8')) as Shapes

/** タイルの線(点の並び)。side 0 = 左か上、1 = 右か下 */
function tileStrokes(char: string, side: 0 | 1): Point[][] {
  const split = shapes.splits[char]
  const strokes = shapes.characters[char]
  return strokes
    .filter((_, index) => split.first.includes(index) === (side === 0))
    .map((flat) => {
      const points: Point[] = []
      for (let i = 0; i < flat.length; i += 2) points.push([flat[i], flat[i + 1]])
      return points
    })
}

/** 一辺 1 に収めた点の集まり(形どうしを比べるため) */
function fitted(strokes: Point[][]): Point[] {
  const points = strokes.flat()
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const width = Math.max(...xs) - left
  const height = Math.max(...ys) - top
  const size = Math.max(width, height, 1e-6)
  return points.map(([x, y]) => [(x - left + (size - width) / 2) / size, (y - top + (size - height) / 2) / size])
}

/** 2つの形の近さ(それぞれの点から、相手のいちばん近い点までの距離の平均を、両方向で平均) */
function shapeDistance(a: Point[], b: Point[]): number {
  const oneWay = (from: Point[], to: Point[]) =>
    from.reduce((sum, p) => sum + Math.min(...to.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))), 0) / from.length
  return (oneWay(a, b) + oneWay(b, a)) / 2
}

const cache = new Map<string, Point[]>()
function shapeOf(id: string): Point[] {
  let found = cache.get(id)
  if (!found) {
    const [char, side] = id.split('|')
    found = fitted(tileStrokes(char, Number(side) as 0 | 1))
    cache.set(id, found)
  }
  return found
}
const nameOf = (id: string) => {
  const [char, side] = id.split('|')
  return shapes.splits[char].names[Number(side)]
}

/** その2つのタイルが、見分けのつかない同じ部品か */
function looksSame(a: string, b: string): boolean {
  const nameA = nameOf(a)
  const nameB = nameOf(b)
  if (nameA && nameB) return nameA === nameB
  return shapeDistance(shapeOf(a), shapeOf(b)) < SAME_SHAPE
}

function puzzleOf(answer: string): { layout: Split['layout']; tiles: string[] } | null {
  const split = shapes.splits[answer]
  if (!split) return null
  const correct = [`${answer}|0`, `${answer}|1`]
  const pools: [string[], string[]] = [[], []]
  for (const other of shapes.similar[answer] ?? []) {
    if (other === answer || shapes.splits[other]?.layout !== split.layout) continue
    pools[0].push(`${other}|0`)
    pools[1].push(`${other}|1`)
  }

  const decoys: string[] = []
  const take = (id: string) => {
    if (decoys.length >= TILE_COUNT - 2) return
    // 答えの字そのものの形(安 に対する 案 の上)は、ハズレに出すと紛らわしい
    if (nameOf(id) === answer) return
    const [source, side] = id.split('|')
    // 正解の部品と同じ字を分けたタイル(音 の正解の 立 に対する、立 の上の 亠 と下の部分)は出さない。
    // 正解の部品の一部分なので、「立」1枚と「亠+下」のどちらが正しいのか見分けがつかない
    if (split.names.includes(source)) return
    // ハズレだけで別の漢字ができないようにする(同じ字の左右・上下をそろえて入れない)
    if (decoys.includes(`${source}|${side === '0' ? 1 : 0}`)) return
    if ([...correct, ...decoys].some((chosen) => looksSame(chosen, id))) return
    decoys.push(id)
  }
  // 左(上)と右(下)で、ハズレを同じ数ずつそろえる。片側だけ少ないと、その側は正解しか無く、見ただけで分かる
  // (音 の上は 立 だけ、組 の左は 糸 だけになっていた)
  const half = (TILE_COUNT - 2) / 2
  const onSide = (side: 0 | 1) => decoys.filter((chosen) => chosen.endsWith(`|${side}`)).length
  const strokeCount = (id: string) => tileStrokes(id.split('|')[0], Number(id.split('|')[1]) as 0 | 1).length
  for (const side of [0, 1] as const) {
    // まず似た漢字の、同じ側の部品(近い順)
    for (const id of pools[side]) {
      if (onSide(side) >= half) break
      take(id)
    }
    // 足りなければ、同じ分かれ方の字全体から、同じ側で正解の部品と画数の近い部品
    if (onSide(side) < half) {
      const target = strokeCount(correct[side])
      const fill = Object.keys(shapes.splits)
        .filter((char) => char !== answer && shapes.splits[char].layout === split.layout)
        .map((char) => `${char}|${side}`)
        .map((id) => ({ id, gap: Math.abs(target - strokeCount(id)) }))
        .sort((a, b) => a.gap - b.gap || a.id.localeCompare(b.id))
      for (const { id } of fill) {
        if (onSide(side) >= half) break
        take(id)
      }
    }
  }

  if (decoys.length < MIN_DECOYS) return null
  return { layout: split.layout, tiles: [...correct, ...decoys] }
}

function main(): void {
  const questions = (JSON.parse(readFileSync(QUESTIONS, 'utf8')) as { questions: { answer: string; level: string }[] })
    .questions
  const levels = ['g12', 'g34', 'g56', 'junior', 'senior', 'working']
  /** level は小1・小2の字だけ持つ(この学年は熟語の問題が無く、パズルの問題をこの一覧から作る) */
  const puzzles: Record<string, { layout: Split['layout']; tiles: string[]; level?: 'g12' }> = {}

  if (process.argv.includes('--calibrate')) {
    // 同じ名前の部品どうしと、違う名前どうしの形の近さ(SAME_SHAPE を決めるため)
    const ids = Object.keys(shapes.splits).flatMap((char) => [`${char}|0`, `${char}|1`])
    const same: number[] = []
    const different: number[] = []
    for (let i = 0; i < 4000; i += 1) {
      const a = ids[(i * 7919) % ids.length]
      const b = ids[(i * 104729 + 13) % ids.length]
      if (a === b || !nameOf(a) || !nameOf(b)) continue
      ;(nameOf(a) === nameOf(b) ? same : different).push(shapeDistance(shapeOf(a), shapeOf(b)))
    }
    // 同じ名前どうしは少ないので、名前でまとめて足す
    const byName = new Map<string, string[]>()
    for (const id of ids) if (nameOf(id)) byName.set(nameOf(id), [...(byName.get(nameOf(id)) ?? []), id])
    for (const group of [...byName.values()].filter((g) => g.length >= 2).slice(0, 300)) {
      same.push(shapeDistance(shapeOf(group[0]), shapeOf(group[1])))
    }
    const q = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      return [0.1, 0.5, 0.9, 0.99].map((p) => sorted[Math.floor(p * (sorted.length - 1))].toFixed(3)).join(' ')
    }
    console.log(`同じ名前どうし ${same.length}組 (10% 中央 90% 99%): ${q(same)}`)
    console.log(`違う名前どうし ${different.length}組 (10% 中央 90% 99%): ${q(different)}`)
    return
  }

  for (const level of levels) {
    const answers =
      level === 'g12' ? shapes.low : [...new Set(questions.filter((q) => q.level === level).map((q) => q.answer))]
    let made = 0
    const examples: string[] = []
    for (const answer of answers) {
      const puzzle = puzzleOf(answer)
      if (!puzzle) continue
      puzzles[answer] = level === 'g12' ? { ...puzzle, level: 'g12' } : puzzle
      made += 1
      if (examples.length < 4) examples.push(`${answer}[${puzzle.tiles.map((id) => nameOf(id) || '?').join(' ')}]`)
    }
    console.log(`${level}: ${answers.length}字中 ${made}字  例 ${examples.join('  ')}`)
  }
  if (process.argv.includes('--report')) return

  const payload = {
    _source: {
      note: '自動生成。編集しても npm run puzzles:kanji で上書きされる',
      generatedAt: new Date().toISOString(),
      credit: 'KanjiVG — Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0 (shapes.kanji.generated.json から作った)',
      format:
        'puzzles[答え] = { layout: horizontal=左右 / vertical=上下, tiles: 先頭2つが正解(左か上, 右か下)、残りがハズレ, ' +
        'level: 小1・小2の字だけ g12 }。タイルは「字|0(左か上)」「字|1(右か下)」',
    },
    puzzles,
  }
  writeFileSync(OUT, `${JSON.stringify(payload)}\n`)
  console.log(`書き出し: ${OUT} (${Object.keys(puzzles).length}字)`)
}

main()
