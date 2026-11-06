/**
 * 漢字の手書きを自動で判定するための、お手本の形と「似た漢字」を生成する。
 *
 * 出題では答えの漢字が分かっているので、「書いた字は何か」を何千字から当てるのではなく、
 * 「書いた字は答えの漢字か」を確かめればよい。そのために答えの漢字のお手本の線と、
 * 取り違えやすい**形の似た漢字**のお手本の線を持っておく(似た字より答えのほうがはっきり近いときだけ
 * 自動でせいかいにする)。
 *
 * - お手本の線: KanjiVG。SVG の曲線を、線に沿った点の並びに直して持つ
 *   (アプリで SVG を描いて測らずに済み、学習側の Python からも同じデータを使える)
 * - 似た漢字: KRADFILE の部品の重なりと、画数の近さで選ぶ(未と末、待と持)。候補は常用漢字
 *
 * 使い方:
 *   npm run dict:fetch          # 初回のみ(KanjiVG・KRADFILE・KANJIDIC2 も一緒に落ちる)
 *   npm run shapes:kanji
 *   npm run shapes:kanji -- --report   # 書き出さず、似た漢字の例だけ確認
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CACHE_DIR, readDict } from './dict-cache.ts'

const OUT = fileURLToPath(new URL('../src/data/shapes.kanji.generated.json', import.meta.url))
const QUESTIONS = fileURLToPath(new URL('../src/data/questions.kanji.generated.json', import.meta.url))

/**
 * 答え1字あたりの似た漢字の数。多いほど慎重になるが、比べる時間とファイルが増える。
 * 8字では、候補に入っていない字(暗に対する暁)を書いたときに答えがいちばん近くなり、自動でせいかいになった
 */
const SIMILAR = 24
/**
 * 似た漢字とみなす部品の重なり(共通の部品 ÷ どちらかにある部品)の下限。
 * 0.5 だと、問(門・口)と間(門・日)のように部品の少ない字どうしの取り違えを拾えなかった
 */
const MIN_OVERLAP = 0.3
/** 線に沿って点を置く間隔(KanjiVG の座標で。全体は 109 四方)。短い線でも両端と真ん中は置く */
const STEP = 8
const MIN_POINTS = 3

/** KANJIDIC2 の配当学年。1〜6 が小学校、8 が中学校以上の常用漢字(9・10 は人名用) */
const JOYO_GRADES = [1, 2, 3, 4, 5, 6, 8]

interface Kanjidic2 {
  characters: { literal: string; misc: { grade: number | null; strokeCounts: number[] } }[]
}
interface Kradfile {
  kanji: Record<string, string[]>
}

type Point = [number, number]

/** KanjiVG のファイル名は文字のコードポイント5桁16進 */
const idOf = (char: string) => char.codePointAt(0)!.toString(16).padStart(5, '0')

/** その文字の線(SVG パス)を書き順どおりに取り出す(build-strokes.ts と同じ) */
function pathsOf(xml: string, char: string): string[] {
  const start = xml.indexOf(`<kanji id="kvg:kanji_${idOf(char)}">`)
  if (start === -1) return []
  const block = xml.slice(start, xml.indexOf('</kanji>', start))
  return [...block.matchAll(/<path [^>]*\bd="([^"]+)"/g)].map((m) => m[1])
}

/**
 * SVG パスを、細かい点の並びに直す。KanjiVG が使うのは M m C c S s だけ。
 * 曲線(3次ベジェ)は1区間を 16 に割って点を取る(あとで線の長さに沿って間引く)。
 */
function trace(d: string): Point[] {
  const tokens = [...d.matchAll(/[MmCcSs]|-?\d*\.?\d+(?:e-?\d+)?/g)].map((m) => m[0])
  const points: Point[] = []
  let current: Point = [0, 0]
  let lastControl: Point | null = null
  let command = ''
  let i = 0
  const number = () => Number(tokens[i++])

  const curve = (c1: Point, c2: Point, end: Point) => {
    const start = current
    for (let step = 1; step <= 16; step += 1) {
      const t = step / 16
      const u = 1 - t
      points.push([
        u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0],
        u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1],
      ])
    }
    lastControl = c2
    current = end
  }

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++]
    const relative = command === command.toLowerCase()
    const base: Point = relative ? current : [0, 0]
    const point = (): Point => [base[0] + number(), base[1] + number()]
    switch (command.toLowerCase()) {
      case 'm':
        current = point()
        points.push(current)
        lastControl = null
        // M のあとに続く座標は直線(KanjiVG では出てこないが、念のため曲線と同じ扱いにしない)
        command = relative ? 'l' : 'L'
        break
      case 'c': {
        const c1 = point()
        const c2 = point()
        curve(c1, c2, point())
        break
      }
      case 's': {
        // 1つめの制御点は、前の曲線の2つめの制御点を今の点で折り返したもの
        const c1: Point = lastControl ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current
        const c2 = point()
        curve(c1, c2, point())
        break
      }
      default:
        throw new Error(`知らないパスの命令: ${command} (${d})`)
    }
  }
  return points
}

/** 線の長さに沿って、ほぼ STEP おきに点を置き直す(両端は必ず残す)。座標は整数に丸める */
function resample(points: Point[]): Point[] {
  const lengths = [0]
  for (let k = 1; k < points.length; k += 1) {
    lengths.push(lengths[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]))
  }
  const total = lengths.at(-1)!
  const count = Math.max(MIN_POINTS, Math.round(total / STEP) + 1)
  const out: Point[] = []
  let k = 0
  for (let n = 0; n < count; n += 1) {
    const at = (total * n) / (count - 1)
    while (k < lengths.length - 2 && lengths[k + 1] < at) k += 1
    const span = lengths[k + 1] - lengths[k] || 1
    const t = Math.min(1, Math.max(0, (at - lengths[k]) / span))
    const a = points[k]
    const b = points[Math.min(k + 1, points.length - 1)]
    out.push([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)])
  }
  return out
}

interface Group {
  element: string
  /** KanjiVG の kvg:position(left / right / top / bottom など)。無いものは空 */
  position: string
  /** 部品が途中で分かれて書かれる、その片方(kvg:part が付いている。哀 の 衣 は 口 をはさんで2つに分かれる) */
  partial: boolean
  children: (Group | number)[]
}

/**
 * その文字の部品のまとまり(KanjiVG の入れ子の <g>)を読む。線は書き順の番号(0 から)で持つ。
 * 部品の名前は kvg:element(無いものは空)。
 */
function groupsOf(xml: string, char: string): Group | null {
  const start = xml.indexOf(`<kanji id="kvg:kanji_${idOf(char)}">`)
  if (start === -1) return null
  const block = xml.slice(start, xml.indexOf('</kanji>', start))
  const root: Group = { element: '', position: '', partial: false, children: [] }
  const stack: Group[] = [root]
  let stroke = 0
  for (const tag of block.matchAll(/<g\b[^>]*>|<\/g>|<path\b[^>]*>/g)) {
    const text = tag[0]
    if (text.startsWith('</g')) {
      stack.pop()
    } else if (text.startsWith('<g')) {
      const group: Group = {
        element: /kvg:element="([^"]*)"/.exec(text)?.[1] ?? '',
        position: /kvg:position="([^"]*)"/.exec(text)?.[1] ?? '',
        partial: /kvg:part="/.test(text),
        children: [],
      }
      stack.at(-1)!.children.push(group)
      if (!text.endsWith('/>')) stack.push(group)
    } else {
      stack.at(-1)!.children.push(stroke)
      stroke += 1
    }
  }
  // いちばん外の <g> が字そのもの
  const outer = root.children[0]
  return typeof outer === 'object' ? outer : null
}

function strokesIn(group: Group | number): number[] {
  return typeof group === 'number' ? [group] : group.children.flatMap(strokesIn)
}

/**
 * 1つのまとまりを、中の部品ごとの線の番号に分ける。部品が2つ以上に分かれ、
 * まとまりの線を全部覆うときだけ(線が部品に入らずに直に並ぶものは分けない)。
 * 同じ名前の部品は1つにまとめる(囗 は中の部品をはさんで2回に分けて書かれる)。
 */
function splitOf(group: Group): number[][] | null {
  if (group.children.some((child) => typeof child === 'number')) return null
  const byElement = new Map<string, number[]>()
  group.children.forEach((child, index) => {
    const key = (child as Group).element || `#${index}`
    byElement.set(key, [...(byElement.get(key) ?? []), ...strokesIn(child)])
  })
  const parts = [...byElement.values()]
  return parts.length >= 2 ? parts : null
}

/**
 * 部品ごとの線の番号。1段め(網なら 糸・罔)と、その中がさらに分かれれば2段め(罔なら 罒・亡)も並べる。
 * 線が1本だけの部品は比べても意味が薄いので入れない。分かれない字は空。
 */
function componentsOf(xml: string, char: string): number[][] {
  const outer = groupsOf(xml, char)
  if (!outer) return []
  const first = splitOf(outer)
  if (!first) return []
  const out: number[][] = []
  outer.children.forEach((child) => {
    if (typeof child === 'number') return
    const second = splitOf(child)
    if (second) out.push(...second.filter((part) => part.length >= 2))
  })
  return [...first.filter((part) => part.length >= 2), ...out]
}

/** パズルに使う、字の2つの分け方 */
interface PuzzleSplit {
  /** horizontal = 左右、vertical = 上下 */
  layout: 'horizontal' | 'vertical'
  /** 左(または上)の部品の線の番号。右(または下)は残りの線 */
  first: number[]
  /** 部品の名前(KanjiVG の kvg:element)。[左か上, 右か下]。付いていない部品は空 */
  names: [string, string]
}

/**
 * パズルに使う、字の2つの分け方。いちばん外のまとまりが、左右(left / right)か
 * 上下(top / bottom)の2つの部品だけに分かれる字だけ(線が部品に入らずに並ぶ字・たれ・にょう・かまえは除く)。
 */
function splitForPuzzle(xml: string, char: string): PuzzleSplit | null {
  const outer = groupsOf(xml, char)
  if (!outer || outer.children.length !== 2) return null
  const [a, b] = outer.children
  if (typeof a === 'number' || typeof b === 'number') return null
  const positions = `${a.position}/${b.position}`
  if (positions !== 'left/right' && positions !== 'top/bottom') return null
  // 部品が途中で分かれて書かれる字は、片方ずつでは部品の形にならない(哀 が 亠 と 口+衣の下 になる)
  if (a.partial || b.partial) return null
  const first = strokesIn(a)
  if (!first.length || !strokesIn(b).length) return null
  return { layout: positions === 'left/right' ? 'horizontal' : 'vertical', first, names: [a.element, b.element] }
}

/** 1字ぶんのお手本。線ごとに [x, y, x, y, ...] と平らに並べる(ファイルを小さくするため) */
function shapeOf(xml: string, char: string): number[][] | null {
  const paths = pathsOf(xml, char)
  if (!paths.length) return null
  return paths.map((d) => resample(trace(d)).flat())
}

/**
 * 形の似た漢字を選ぶ。部品の重なりが MIN_OVERLAP 以上のものを、
 * 重なりが大きく、画数が近い順に並べる(未と末は部品が同じで画数も同じ)。
 */
function similarOf(
  char: string,
  pool: string[],
  partsOf: Map<string, Set<string>>,
  strokesOf: Map<string, number>,
): string[] {
  const mine = partsOf.get(char)
  if (!mine?.size) return []
  const strokes = strokesOf.get(char) ?? 0
  return pool
    .filter((other) => other !== char)
    .map((other) => {
      const theirs = partsOf.get(other)
      if (!theirs?.size) return { other, score: -1 }
      const shared = [...mine].filter((part) => theirs.has(part)).length
      const overlap = shared / new Set([...mine, ...theirs]).size
      if (overlap < MIN_OVERLAP) return { other, score: -1 }
      return { other, score: overlap - 0.05 * Math.abs(strokes - (strokesOf.get(other) ?? 0)) }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SIMILAR)
    .map((entry) => entry.other)
}

function main(): void {
  const xml = readFileSync(join(CACHE_DIR, 'kanjivg.xml'), 'utf8')
  const kanjidic = readDict<Kanjidic2>('kanjidic2-en')
  const kradfile = readDict<Kradfile>('kradfile')

  // 小1・小2の漢字は熟語の穴うめに出ないが、パズル(お手本を見てから選ぶ)には出すので、答えと同じく扱う
  const low = kanjidic.characters.filter((c) => c.misc.grade === 1 || c.misc.grade === 2).map((c) => c.literal)
  const answers = [
    ...new Set([
      ...(JSON.parse(readFileSync(QUESTIONS, 'utf8')) as { questions: { answer: string }[] }).questions.map(
        (question) => question.answer,
      ),
      ...low,
    ]),
  ]
  const joyo = kanjidic.characters
    .filter((c) => c.misc.grade != null && JOYO_GRADES.includes(c.misc.grade))
    .map((c) => c.literal)
  const strokesOf = new Map(kanjidic.characters.map((c) => [c.literal, c.misc.strokeCounts[0] ?? 0]))
  const partsOf = new Map(Object.entries(kradfile.kanji).map(([char, parts]) => [char, new Set(parts)]))

  // 似た漢字の候補は、お手本の線があるものだけ
  const pool = joyo.filter((char) => pathsOf(xml, char).length > 0)
  const similar: Record<string, string[]> = {}
  for (const answer of answers) similar[answer] = similarOf(answer, pool, partsOf, strokesOf)

  const needed = [...new Set([...answers, ...Object.values(similar).flat()])]
  const characters: Record<string, number[][]> = {}
  const parts: Record<string, number[][]> = {}
  const splits: Record<string, PuzzleSplit> = {}
  const missing: string[] = []
  for (const char of needed) {
    const shape = shapeOf(xml, char)
    if (shape) {
      characters[char] = shape
      const split = componentsOf(xml, char)
      if (split.length) parts[char] = split
      const halves = splitForPuzzle(xml, char)
      if (halves) splits[char] = halves
    }
    else missing.push(char)
  }

  const withSimilar = answers.filter((answer) => similar[answer].length > 0).length
  console.log(`答えの漢字 ${answers.length}字(似た漢字のあるもの ${withSimilar}字)/ お手本 ${Object.keys(characters).length}字`)
  if (missing.length) console.log(`KanjiVG に無い字: ${missing.join('')}`)
  console.log(`部品に分かれる字 ${Object.keys(parts).length}字  例 網: ${JSON.stringify(componentsOf(xml, '網'))} 国: ${JSON.stringify(componentsOf(xml, '国'))}`)
  for (const char of ['未', '末', '待', '持', '問', '間', '績', '積', '輸', '輪']) {
    if (similar[char]) console.log(`  ${char}: ${similar[char].join('')}`)
  }
  if (process.argv.includes('--report')) return

  const payload = {
    _source: {
      note: '自動生成。編集しても npm run shapes:kanji で上書きされる',
      generatedAt: new Date().toISOString(),
      credit: [
        'KanjiVG — Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0 (http://kanjivg.tagaini.net)',
        'KRADFILE / KANJIDIC2 — EDRDG, CC BY-SA 4.0',
      ],
      changes: 'KanjiVG の線(SVG パス)を、線に沿った点の並びに直した。似た漢字は KRADFILE の部品の重なりで選んだ',
      /** KanjiVG の座標系。点はこの正方形の中に収まっている */
      viewBox: 109,
      /** 線ごとに [x, y, x, y, ...] */
      format:
        'characters[字] = 線の配列(書き順)。線は x, y を交互に並べた整数。' +
        'parts[字] = 部品ごとの線の番号(0 から)。1段めの部品のあとに、その中の2段めの部品が続く。' +
        'splits[字] = パズル用の2つの分け方(layout: horizontal=左右 / vertical=上下、first=左か上の線の番号で右か下は残り、names=部品の名前)',
    },
    characters,
    parts,
    splits,
    /** 小1・小2の漢字(パズルで、お手本を見てから選ぶ問題にする) */
    low: low.filter((char) => characters[char]),
    similar,
  }
  writeFileSync(OUT, `${JSON.stringify(payload)}\n`)
  console.log(`書き出し: ${OUT}`)
}

main()
