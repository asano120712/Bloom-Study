import { distance, lengthOf, resample, type Point } from './geometry'

/**
 * 薄いお手本の上に書いた字が、どれだけきれいに書けたか。
 *
 * 字を読み取るのではなく、お手本の線と1画ずつ重ね合わせて比べる(書き順のデータがあるので、
 * 読み取りのモデルは要らない)。見るのは次の3つ。
 * - 形: 書いた線が、お手本の線からどれだけ離れているか
 * - 向き: 始めと終わりを逆に書いていないか
 * - 書き順: 画の順番と、画数が合っているか
 *
 * 結果は3段階。点数にすると、判定の甘さ・厳しさのぶれ(72点と75点の違い)が目立ってしまう。
 * 書き順や向きの間違いは、やり直しにはせず、段階を1つ下げるだけにする。
 */
export type TraceGrade = 'neat' | 'fair' | 'rough'

/** お手本の1画ぶんの見立て */
export interface StrokeCheck {
  /** この画として見た、書いた線の番号。対応する線が無ければ null(書けていない) */
  written: number | null
  /** 形のずれ。お手本の線との平均の距離(座標系の長さ) */
  offset: number
  /** 形のずれの段階 */
  shape: 'good' | 'ok' | 'off'
  /** 始めと終わりを逆に書いた */
  reversed: boolean
}

export interface TraceJudgement {
  grade: TraceGrade
  checks: StrokeCheck[]
  /** どの画にも当てはまらなかった、書いた線の数(よけいな線) */
  extra: number
  /** 書いた線の数 */
  written: number
  /** 書き順が違うところがある */
  orderWrong: boolean
}

/** 比べるときに1画を取り直す点の数 */
const POINTS = 24
/**
 * 形のずれの境目(座標系の長さ。お手本の枠は 109)。
 * お手本の線(太さ 5〜10)の上をたどれていれば good、線の脇を通っていれば ok。
 */
const SHAPE = { good: 5, ok: 9 }
/** これより離れた線は、その画を書いたとはみなさない(別の画か、よけいな線) */
const MATCH_LIMIT = 22
/** これより短い画(点など)は、向きを問わない。短いと始めと終わりの区別がつかない */
const DIRECTION_MIN_LENGTH = 14

function meanGap(a: Point[], b: Point[]): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += distance(a[i], b[i])
  return total / a.length
}

/** 1本の書いた線と、お手本の1画の比べ。逆向きに書いた場合も比べて、近いほうを取る */
function compare(written: Point[], model: Point[]) {
  const forward = meanGap(written, model)
  const backward = meanGap([...written].reverse(), model)
  return { offset: Math.min(forward, backward), reversed: backward < forward }
}

export function judgeTrace(model: Point[][], strokes: Point[][]): TraceJudgement {
  const models = model.map((points) => resample(points, POINTS))
  const writtens = strokes.filter((points) => points.length > 0).map((points) => resample(points, POINTS))

  // 書いた線とお手本の画の組み合わせを、近いものから順に決める。
  // 書いた順番どおりに当てはめると、書き順を1つ間違えただけで後ろの画が全部ずれてしまう
  const pairs = writtens.flatMap((written, w) =>
    models.map((points, m) => ({ w, m, ...compare(written, points) })),
  )
  pairs.sort((a, b) => a.offset - b.offset)

  const checks: StrokeCheck[] = models.map(() => ({
    written: null,
    offset: Infinity,
    shape: 'off',
    reversed: false,
  }))
  const usedWritten = new Set<number>()
  for (const pair of pairs) {
    if (pair.offset > MATCH_LIMIT) break
    if (usedWritten.has(pair.w) || checks[pair.m].written !== null) continue
    usedWritten.add(pair.w)
    checks[pair.m] = {
      written: pair.w,
      offset: pair.offset,
      shape: pair.offset <= SHAPE.good ? 'good' : pair.offset <= SHAPE.ok ? 'ok' : 'off',
      reversed: pair.reversed && lengthOf(model[pair.m]) >= DIRECTION_MIN_LENGTH,
    }
  }

  // お手本の画の順に並べたとき、書いた順も同じように増えていれば書き順は合っている
  const order = checks.flatMap((check) => (check.written === null ? [] : [check.written]))
  const orderWrong = order.some((written, index) => index > 0 && written < order[index - 1])
  const extra = writtens.length - usedWritten.size

  // 形で段階を決め、書き順・向き・よけいな線があれば1つずつ下げる
  const shapes = checks.map((check) => check.shape)
  let level = shapes.includes('off') ? 0 : shapes.includes('ok') ? 1 : 2
  if (orderWrong) level -= 1
  if (checks.some((check) => check.reversed)) level -= 1
  if (extra > 0) level -= 1

  return {
    grade: level >= 2 ? 'neat' : level === 1 ? 'fair' : 'rough',
    checks,
    extra,
    written: writtens.length,
    orderWrong,
  }
}
