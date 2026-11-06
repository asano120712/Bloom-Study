import type { Point, Stroke } from './word'

/**
 * 手書きの漢字が、答えの漢字の形になっているかを見る。
 *
 * 出題では答えが分かっているので、何千字から当てるのではなく、答えの漢字と
 * **形の似た漢字**(未と末、待と持)だけと比べる。お手本は KanjiVG の線
 * (scripts/build-kanji-shapes.ts が点の並びに直したもの)。
 *
 * **書き順と画数は問わない。** 見るのは形だけで、2つの見方で近さを出す。
 * - 線で比べる: 書いた線とお手本の線を、順番ではなく位置と形でいちばん合う組に対応させる
 *   (線の向きも問わない)。対応する相手の無い線は少し減点する
 * - 絵で比べる: 書いた字とお手本を同じ太さの線で描き直し、線の近さ(chamfer)で比べる。
 *   2画をつなげて書いた、1画を2本に分けた、といった画数の違いはこちらで拾う
 * - 部品ごとに比べる: お手本の部品(網なら 糸・罔・罒・亡)ごとに、対応した書いた線を集め、
 *   部品の大きさにそろえて線で比べる。字全体でそろえると、網と綱のように部品の中だけが違う字は
 *   違いが小さく埋もれてしまうため
 */

/** お手本の座標系(KanjiVG の正方形の一辺) */
const VIEW_BOX = 109
/** 1本の線を並べ直す点の数 */
const POINTS_PER_STROKE = 10
/** 線で比べるとき、対応する相手の無い線1本ぶんの減点(枠の一辺を 1 としたときの距離) */
const UNMATCHED = 0.25
/**
 * 絵で比べるときのマス目の細かさと線の太さ。
 * 英字と同じ 32 マスでは、画数の多い字の中の細かい線がつぶれ、網と綱(冂の中身だけが違う)を
 * 見分けられなかった。漢字は 64 マスで描き直して比べる
 */
const GRID = 64
const GRID_MARGIN = GRID / 16
const GRID_LINE = GRID / 24

interface Shapes {
  /** 字 → 線の配列(書き順)。線は x, y を交互に並べたもの(KanjiVG の座標) */
  characters: Record<string, number[][]>
  /** 字 → 部品ごとの線の番号(0 から)。部品に分かれない字は無い */
  parts: Record<string, number[][]>
  /** 答えの漢字 → 形の似た漢字 */
  similar: Record<string, string[]>
}

let loading: Promise<Shapes> | null = null

/** お手本と似た漢字(946KB)。漢字を手書きで答えるときだけ読む */
export function kanjiShapes(): Promise<Shapes> {
  if (!loading) {
    loading = import('@/data/shapes.kanji.generated.json').then((module) => module.default as unknown as Shapes)
  }
  return loading
}

/** 全体を一辺 1 の正方形に収める(縦横は同じ倍率で、真ん中に置く) */
function fitToUnit(strokes: Point[][]): Point[][] {
  const points = strokes.flat()
  if (!points.length) return strokes
  const left = Math.min(...points.map((p) => p.x))
  const top = Math.min(...points.map((p) => p.y))
  const width = Math.max(...points.map((p) => p.x)) - left
  const height = Math.max(...points.map((p) => p.y)) - top
  const size = Math.max(width, height, 1e-6)
  const offsetX = (size - width) / 2
  const offsetY = (size - height) / 2
  return strokes.map((stroke) =>
    stroke.map((p) => ({ x: (p.x - left + offsetX) / size, y: (p.y - top + offsetY) / size })),
  )
}

/** 線の長さに沿って、決まった数の点に並べ直す(書く速さで点の間隔がばらつくのをならす) */
function resample(stroke: Point[], count = POINTS_PER_STROKE): Point[] {
  if (stroke.length === 1) return Array.from({ length: count }, () => stroke[0])
  const lengths = [0]
  for (let i = 1; i < stroke.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y))
  }
  const total = lengths.at(-1) ?? 0
  const out: Point[] = []
  let k = 0
  for (let n = 0; n < count; n += 1) {
    const at = (total * n) / (count - 1)
    while (k < lengths.length - 2 && lengths[k + 1] < at) k += 1
    const span = lengths[k + 1] - lengths[k] || 1
    const t = Math.min(1, Math.max(0, (at - lengths[k]) / span))
    const a = stroke[k]
    const b = stroke[Math.min(k + 1, stroke.length - 1)]
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}

/** 2本の線の離れ具合(点ごとの距離の平均)。向きは問わないので、逆向きにした場合と近いほうを採る */
function strokeDistance(a: Point[], b: Point[]): number {
  let forward = 0
  let backward = 0
  for (let i = 0; i < a.length; i += 1) {
    forward += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y)
    const r = b[b.length - 1 - i]
    backward += Math.hypot(a[i].x - r.x, a[i].y - r.y)
  }
  return Math.min(forward, backward) / a.length
}

/**
 * いちばん合計の小さい組み合わせ(ハンガリアン法)。cost は正方形の行列。
 * 返すのは、行ごとに対応した列。
 */
function assign(cost: number[][]): number[] {
  const n = cost.length
  const u = new Array<number>(n + 1).fill(0)
  const v = new Array<number>(n + 1).fill(0)
  const p = new Array<number>(n + 1).fill(0)
  const way = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= n; i += 1) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY)
    const used = new Array<boolean>(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Number.POSITIVE_INFINITY
      let j1 = 0
      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const rowToColumn = new Array<number>(n).fill(-1)
  for (let j = 1; j <= n; j += 1) if (p[j]) rowToColumn[p[j] - 1] = j - 1
  return rowToColumn
}

/**
 * 線で比べた離れ具合。0 でぴったり、大きいほど遠い。
 * 書いた線とお手本の線を、合計がいちばん小さくなるように1本ずつ対応させる(書き順は見ない)。
 * 本数が違うときは、相手の無い線1本につき UNMATCHED を足す。
 * 対応(お手本の線ごとに、対応した書いた線の番号。相手が無ければ -1)も返す(部品ごとに比べるため)。
 */
function strokesDistance(written: Point[][], model: Point[][]): { distance: number; matchOf: number[] } {
  const size = Math.max(written.length, model.length)
  if (!size) return { distance: Number.POSITIVE_INFINITY, matchOf: [] }
  const cost = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) =>
      i < written.length && j < model.length ? strokeDistance(written[i], model[j]) : UNMATCHED,
    ),
  )
  const pairs = assign(cost)
  const matchOf = new Array<number>(model.length).fill(-1)
  pairs.forEach((j, i) => {
    if (i < written.length && j < model.length) matchOf[j] = i
  })
  return { distance: pairs.reduce((sum, j, i) => sum + cost[i][j], 0) / size, matchOf }
}

/**
 * 部品ごとに比べた離れ具合のうち、いちばん合っていない部品の値。
 *
 * 字全体での対応(matchOf)をそのまま使い、部品に入るお手本の線と、それに対応した書いた線を、
 * それぞれ部品の大きさにそろえ直して比べる。相手の無いお手本の線は UNMATCHED として数える。
 * 部品に分かれない字は 0。
 */
function partsDistance(written: Point[][], model: Point[][], matchOf: number[], parts: number[][]): number {
  let worst = 0
  for (const part of parts) {
    const matched = part.filter((j) => matchOf[j] >= 0)
    if (!matched.length) {
      worst = Math.max(worst, UNMATCHED * 4)
      continue
    }
    const mine = fitToUnit(matched.map((j) => written[matchOf[j]]))
    const theirs = fitToUnit(matched.map((j) => model[j]))
    const total = matched.reduce((sum, _, k) => sum + strokeDistance(mine[k], theirs[k]), 0)
    worst = Math.max(worst, (total + UNMATCHED * (part.length - matched.length)) / part.length)
  }
  return worst
}

interface Picture {
  /** 線のあるマスが 1 */
  bitmap: Uint8Array
  /** 各マスから、いちばん近い線までの距離 */
  field: Float32Array
}

/** 各マスから、いちばん近い線までの距離(2回なめる chamfer 距離変換。distance.ts と同じ手順で、大きさだけ違う) */
function distanceField(bitmap: Uint8Array): Float32Array {
  const field = new Float32Array(GRID * GRID)
  for (let i = 0; i < field.length; i += 1) field[i] = bitmap[i] ? 0 : GRID * 2
  const spread = (x: number, y: number, fromX: number, fromY: number, cost: number) => {
    if (fromX < 0 || fromY < 0 || fromX >= GRID || fromY >= GRID) return
    const next = field[fromY * GRID + fromX] + cost
    if (next < field[y * GRID + x]) field[y * GRID + x] = next
  }
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      spread(x, y, x - 1, y, 1)
      spread(x, y, x, y - 1, 1)
      spread(x, y, x - 1, y - 1, Math.SQRT2)
      spread(x, y, x + 1, y - 1, Math.SQRT2)
    }
  }
  for (let y = GRID - 1; y >= 0; y -= 1) {
    for (let x = GRID - 1; x >= 0; x -= 1) {
      spread(x, y, x + 1, y, 1)
      spread(x, y, x, y + 1, 1)
      spread(x, y, x + 1, y + 1, Math.SQRT2)
      spread(x, y, x - 1, y + 1, Math.SQRT2)
    }
  }
  return field
}

/** 両方向の平均距離(マス単位)。小さいほど近い */
function chamfer(a: Picture, b: Picture): number {
  const oneWay = (bitmap: Uint8Array, field: Float32Array) => {
    let total = 0
    let count = 0
    for (let i = 0; i < bitmap.length; i += 1) {
      if (!bitmap[i]) continue
      total += field[i]
      count += 1
    }
    return count === 0 ? GRID : total / count
  }
  return (oneWay(a.bitmap, b.field) + oneWay(b.bitmap, a.field)) / 2
}

/** 一辺 1 に収めた線を、GRID 角のマスに描き直して白黒にする(絵で比べるため) */
function bitmapOf(strokes: Point[][]): Picture | null {
  const canvas = document.createElement('canvas')
  canvas.width = GRID
  canvas.height = GRID
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const margin = GRID_MARGIN
  const scale = GRID - margin * 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = GRID_LINE
  context.strokeStyle = '#000000'
  for (const stroke of strokes) {
    context.beginPath()
    stroke.forEach((p, index) => {
      const x = margin + p.x * scale
      const y = margin + p.y * scale
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    if (stroke.length === 1) context.lineTo(margin + stroke[0].x * scale + 0.1, margin + stroke[0].y * scale)
    context.stroke()
  }
  const data = context.getImageData(0, 0, GRID, GRID).data
  const bitmap = new Uint8Array(GRID * GRID)
  for (let i = 0; i < bitmap.length; i += 1) bitmap[i] = data[i * 4 + 3] >= 96 ? 1 : 0
  return { bitmap, field: distanceField(bitmap) }
}

interface Prepared {
  strokes: Point[][]
  image: Picture | null
}

/** 点 p から、線分 a-b までの距離 */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * 余った線が書かれているかを確かめるときの近さ(部品の大きさを 1 としたとき)。
 * 部品を拡大してから測るので、線どうしの間隔が広がり、抜けた線のそばに別の線がある、が起きにくい。
 * 0.1 では、線を1本抜いた字の半分近くが「書かれている」になった
 */
const MISSING_REACH = 0.05

/**
 * 書いた線と対応できなかったお手本の線が、それでも書かれているか(0〜1。余りが無ければ 1)。
 *
 * 線を1本抜いても、字全体の近さはほとんど変わらず、自動でせいかいになっていた(偽の 為 の横線)。
 * 1本抜くと、お手本の線が1本、対応する相手が無く余る。余った線を含むいちばん小さい部品(無ければ字全体)を
 * 拡大してそろえ、その線の上に、部品に対応した書いた線が通っているかを見る。
 * 2画をつなげて1本で書いたときは、余った線の上をつなげた線が通るので高くなる。
 * (全部の線を見ると、手書きの形の揺れで正しく書いた線まで「近くにない」となった。字全体でも部品ごとでも同じ)
 */
function missingCoverage(written: Point[][], model: Point[][], matchOf: number[], parts: number[][]): number {
  let lowest = 1
  for (const [j, stroke] of model.entries()) {
    if (matchOf[j] >= 0) continue
    const part =
      parts.filter((candidate) => candidate.includes(j)).sort((a, b) => a.length - b.length)[0] ??
      model.map((_, index) => index)
    const mine = part.filter((index) => matchOf[index] >= 0).map((index) => written[matchOf[index]])
    if (!mine.length) {
      lowest = 0
      continue
    }
    const theirs = fitToUnit(part.map((index) => model[index]))[part.indexOf(j)]
    const fittedMine = fitToUnit(mine)
    const near = theirs.filter((p) =>
      fittedMine.some((line) => line.some((a, k) => k > 0 && toSegment(p, line[k - 1], a) <= MISSING_REACH)),
    ).length
    lowest = Math.min(lowest, near / stroke.length)
  }
  return lowest
}

/** お手本はそろえ終わった形を覚えておく(似た漢字は何度も出てくる) */
const prepared = new Map<string, Prepared>()

function prepare(strokes: Point[][]): Prepared {
  const fitted = fitToUnit(strokes)
  return { strokes: fitted.map((stroke) => resample(stroke)), image: bitmapOf(fitted) }
}

function modelOf(char: string, characters: Record<string, number[][]>): Prepared | null {
  const cached = prepared.get(char)
  if (cached) return cached
  const flat = characters[char]
  if (!flat) return null
  const strokes = flat.map((stroke) => {
    const points: Point[] = []
    for (let i = 0; i < stroke.length; i += 2) points.push({ x: stroke[i] / VIEW_BOX, y: stroke[i + 1] / VIEW_BOX })
    return points
  })
  const made = prepare(strokes)
  prepared.set(char, made)
  return made
}

export interface KanjiCandidate {
  char: string
  /** 線で比べた離れ具合(0 でぴったり) */
  strokes: number
  /** 部品ごとに比べたうち、いちばん合っていない部品の離れ具合(部品に分かれない字は 0) */
  parts: number
  /**
   * 書いた線と対応できなかったお手本の線のうち、いちばん書かれていない線の、上に書いた線がある割合(0〜1)。
   * 低いと線が足りない。2画をつなげて書いたときは、余った線の上をつなげた線が通るので高い。余りが無ければ 1
   */
  covered: number
  /** 書いた線の本数 - お手本の画数(つなげて書くとマイナス、分けて書いたり余計な線があるとプラス) */
  strokeCountDiff: number
  /** 絵で比べた離れ具合(chamfer。64マスの中で平均何マス離れているか) */
  image: number
}

/**
 * 書いた線を、答えの漢字と似た漢字のお手本と比べる。答えが先頭、続いて似た漢字。
 * お手本の無い字は入らない。
 */
export async function compareKanji(written: Stroke[], answer: string): Promise<KanjiCandidate[]> {
  const { characters, parts, similar } = await kanjiShapes()
  const strokes = written.filter((stroke) => stroke.length > 0)
  if (!strokes.length) return []
  const mine = prepare(strokes)

  const out: KanjiCandidate[] = []
  for (const char of [answer, ...(similar[answer] ?? [])]) {
    const model = modelOf(char, characters)
    if (!model) continue
    const matched = strokesDistance(mine.strokes, model.strokes)
    out.push({
      char,
      strokes: matched.distance,
      parts: partsDistance(mine.strokes, model.strokes, matched.matchOf, parts[char] ?? []),
      image: mine.image && model.image ? chamfer(mine.image, model.image) : Number.POSITIVE_INFINITY,
      covered: missingCoverage(mine.strokes, model.strokes, matched.matchOf, parts[char] ?? []),
      strokeCountDiff: mine.strokes.length - model.strokes.length,
    })
  }
  return out
}

/** 試し場で、お手本の線を書いた字と重ねて見せるため(一辺 1 に収めたもの) */
export async function modelStrokes(char: string): Promise<Point[][] | null> {
  const { characters } = await kanjiShapes()
  const flat = characters[char]
  if (!flat) return null
  return fitToUnit(
    flat.map((stroke) => {
      const points: Point[] = []
      for (let i = 0; i < stroke.length; i += 2) points.push({ x: stroke[i], y: stroke[i + 1] })
      return points
    }),
  )
}

/** 書いた線も同じく一辺 1 に収める(試し場で重ねて見せるため) */
export function fitted(strokes: Stroke[]): Point[][] {
  return fitToUnit(strokes)
}

/**
 * 並べるための、線・部品・絵を合わせた離れ具合。小さいほど近い。
 * 線と部品は 0〜0.3 ほど、絵は 0〜3 ほどで動くので、線は 10 倍、部品は 5 倍してそろえる。
 * 部品を重くしすぎると(10 倍以上)、書き方の揺れにも敏感になって、かえって悪くなった。
 */
export function kanjiDistance(candidate: KanjiCandidate): number {
  return candidate.strokes * 10 + candidate.parts * 5 + candidate.image
}

/**
 * 自動で「せいかい」にする条件。答えの漢字がいちばん近く、その距離が KANJI_AUTO_MAX 以下で、
 * 2番めに近い字より KANJI_MARGIN 以上近いとき。
 *
 * 試し場で書いた字(自分の字 277字)で、間違って自動にする字が 0 のまま、正しく書いた字が
 * 多く通る値を探した。部品ごとにも比べるようにして、正しく書いた 156字の 74% → 86% ほどが
 * 自動になった。似た漢字をわざと書いた 121字、関係ない漢字を答えにした 156字は1字も自動にならない。
 * 間違いにいちばん近かったのは、2番めとの差がほぼ無いもの(栽に裁を書いた字、0.04)と、
 * 距離が 4.4 を超えるもの(暗に暁を書いた字)だったので、差は 0.2、距離は少し余裕をみて 4.2 にした。
 */
export const KANJI_AUTO_MAX = 4.2
export const KANJI_MARGIN = 0.2
/**
 * 自動にはしないが、何に見えたかを出してよい距離。答えがいちばん近ければ
 * 「〇〇に見えましたが、自信がありません」、似た漢字のほうが近ければ「書いた字は〇〇に見えました」。
 */
export const KANJI_UNSURE_MAX = KANJI_AUTO_MAX

/**
 * 線が足りない・余計な線がある字を、自動でせいかいにしないための見張り。
 *
 * 全体の近さだけでは、線が1本足りなくても(偽の 為 の横線)、余計な線を足しても自動になっていた。
 * 正しく書いた字から線を1本抜いた字・1本足した字を作って測ると、それぞれ 74%・76% が自動になった。
 * - 書いた線の本数は、お手本の画数と同じか、1本少ないところまで(2画を1本につなげて書くのは許す)。
 *   余計な線を足した字は 76% → 8% になる。画数をまったく見ないと、余計な線はどうしても防げなかった
 * - 対応できずに余ったお手本の線は、部品の中で、その上に書いた線が KANJI_MIN_COVERED 以上通っていること
 *   (つなげて書いた線は余った線の上を通るので、つなげて書いても不利にならない)。
 *   線を1本抜いた字は 74% → 10% になる
 * 正しく書いた字で自動になるのは 87% → 71%(自動にならなかった字は、自己申告に回るだけ)。
 */
export const KANJI_STROKE_COUNT_RANGE = { fewer: 1, more: 0 }
export const KANJI_MIN_COVERED = 0.5

export interface KanjiJudgement {
  accepted: boolean
  /** 何に見えたか。自動でないときに見せる。どれにも近くないときは無い */
  read?: string
  /** read は答え。自信は足りないが、答えに近く読めた */
  likely: boolean
}

/** 線が足りない・余計な線が無さそうか(KANJI_STROKE_COUNT_RANGE と KANJI_MIN_COVERED を見る) */
export function hasAllStrokes(candidate: KanjiCandidate): boolean {
  return (
    candidate.strokeCountDiff >= -KANJI_STROKE_COUNT_RANGE.fewer &&
    candidate.strokeCountDiff <= KANJI_STROKE_COUNT_RANGE.more &&
    candidate.covered >= KANJI_MIN_COVERED
  )
}

/** 書いた線が答えの漢字の形になっているか(出題の画面の自動判定)。「違う」とは決めない */
export async function judgeKanji(written: Stroke[], answer: string): Promise<KanjiJudgement> {
  const candidates = (await compareKanji(written, answer)).sort((a, b) => kanjiDistance(a) - kanjiDistance(b))
  const [best, second] = candidates
  if (!best) return { accepted: false, likely: false }
  const distance = kanjiDistance(best)
  const margin = second ? kanjiDistance(second) - distance : Number.POSITIVE_INFINITY
  if (best.char === answer) {
    // 形は近いが、線が足りない・余計な線がありそうなときは「自信がありません」に回す
    if (distance <= KANJI_AUTO_MAX && margin >= KANJI_MARGIN && hasAllStrokes(best)) {
      return { accepted: true, read: answer, likely: true }
    }
    if (distance <= KANJI_UNSURE_MAX) return { accepted: false, read: answer, likely: true }
    return { accepted: false, likely: false }
  }
  if (distance <= KANJI_AUTO_MAX) return { accepted: false, read: best.char, likely: false }
  return { accepted: false, likely: false }
}
