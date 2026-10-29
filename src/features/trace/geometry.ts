/**
 * なぞり書きのお手本と、書いた線を扱うための形の計算。
 * 座標はお手本の座標系(VIEW_BOX 四方)で持つ。
 */

export interface Point {
  x: number
  y: number
}

export interface StrokeSample {
  length: number
  points: Point[]
}

/** サンプル点の間隔(座標系の長さ)。細かすぎても粗すぎても判定が鈍る */
const SAMPLE_STEP = 2

/** パス上を等間隔に拾う。パスの長さは描かれた要素からしか取れないので、要素を受け取る */
export function sampleOf(path: SVGPathElement | null): StrokeSample {
  if (!path) return { length: 0, points: [] }
  const length = path.getTotalLength()
  const count = Math.max(2, Math.ceil(length / SAMPLE_STEP))
  const points: Point[] = []
  for (let i = 0; i <= count; i++) {
    const { x, y } = path.getPointAtLength((length * i) / count)
    points.push({ x, y })
  }
  return { length, points }
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** 線の長さ(点を順につないだ長さ) */
export function lengthOf(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i])
  return total
}

/**
 * 線を、長さに沿って等間隔の count 点に取り直す。
 * 書く速さで点の詰まり方が変わるので、そのまま比べると速く書いたところが軽く扱われる。
 */
export function resample(points: Point[], count: number): Point[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: count }, () => points[0])
  const total = lengthOf(points)
  if (total === 0) return Array.from({ length: count }, () => points[0])

  const result: Point[] = [points[0]]
  const step = total / (count - 1)
  let target = step
  let walked = 0
  for (let i = 1; i < points.length && result.length < count; i++) {
    const segment = distance(points[i - 1], points[i])
    while (segment > 0 && walked + segment >= target && result.length < count) {
      const t = (target - walked) / segment
      result.push({
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      })
      target += step
    }
    walked += segment
  }
  while (result.length < count) result.push(points[points.length - 1])
  return result
}

/** お手本の線の太さ(お手本の座標系)。線の間が広い字はこの太さで、詰まった字は細くする */
export const LINE_WIDTH = { max: 10, min: 5 }
/** 線と線の間に残したいすき間(お手本の座標系) */
const LINE_GAP = 2

/**
 * 2本の線がどれだけ離れて並んでいるか。
 *
 * 短いほうの線の各点から、もう片方の線までの距離をとり、その真ん中の値を使う。
 * いちばん近いところだけを見ると、角でつながる線(口の角など)や交わる線がほぼ 0 になり、
 * 並んだ線の間隔が測れない。真ん中の値なら、交わる線は大きく、平行に並ぶ線はその間隔になる。
 */
function spacingOf(a: Point[], b: Point[]): number {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  const gaps = short
    .map((point) => Math.min(...long.map((other) => distance(point, other))))
    .sort((x, y) => x - y)
  return gaps[Math.floor(gaps.length / 2)] ?? Infinity
}

/**
 * その字に合うお手本の線の太さ。
 *
 * 鳥・書・曜のように横線が細かく並ぶ字は、いつもの太さ(10)だと線の間がつぶれて
 * 一つのかたまりに見える。いちばん詰まった2本の間隔から、すき間が残る太さまで細くする。
 */
export function lineWidthOf(samples: StrokeSample[]): number {
  let spacing = Infinity
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      spacing = Math.min(spacing, spacingOf(samples[i].points, samples[j].points))
    }
  }
  return Math.max(LINE_WIDTH.min, Math.min(LINE_WIDTH.max, spacing - LINE_GAP))
}
