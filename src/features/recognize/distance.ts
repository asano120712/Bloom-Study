import { SIZE, type Bitmap } from './preprocess'

/**
 * 2つの字がどれだけ近いか。
 *
 * 重なった面積(IoU)だけで見ると、少しずれただけで0に近づく。手書きは必ずずれるので、
 * **線の近さ**で測る(Chamfer距離)。お手本の線から、書いた線のいちばん近いところまでの
 * 距離を平均したもので、ずれても「惜しい」が数字に出る。
 *
 * 片側だけだと、画面を塗りつぶした絵がどんなお手本にも近くなってしまうので、
 * 両方向の平均を取る(お手本→書いた字 と 書いた字→お手本)。
 */

/**
 * 各マスから、いちばん近い線までの距離。
 *
 * 2回なめるだけで求まる(chamfer 距離変換)。斜めは 1.414 ではなく 4/3 で近似する
 * 整数版が有名だが、ここは 32×32 と小さいので素直に実数で持つ。
 */
function distanceField(bitmap: Bitmap): Float32Array {
  const far = SIZE * 2
  const field = new Float32Array(SIZE * SIZE)
  for (let i = 0; i < field.length; i += 1) field[i] = bitmap[i] ? 0 : far

  const spread = (x: number, y: number, fromX: number, fromY: number, cost: number) => {
    if (fromX < 0 || fromY < 0 || fromX >= SIZE || fromY >= SIZE) return
    const next = field[fromY * SIZE + fromX] + cost
    if (next < field[y * SIZE + x]) field[y * SIZE + x] = next
  }

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      spread(x, y, x - 1, y, 1)
      spread(x, y, x, y - 1, 1)
      spread(x, y, x - 1, y - 1, Math.SQRT2)
      spread(x, y, x + 1, y - 1, Math.SQRT2)
    }
  }
  for (let y = SIZE - 1; y >= 0; y -= 1) {
    for (let x = SIZE - 1; x >= 0; x -= 1) {
      spread(x, y, x + 1, y, 1)
      spread(x, y, x, y + 1, 1)
      spread(x, y, x + 1, y + 1, Math.SQRT2)
      spread(x, y, x - 1, y + 1, Math.SQRT2)
    }
  }
  return field
}

/** 距離の場は使い回す。お手本ぶんを毎回作り直すと、候補の数だけ無駄になる */
export function fieldOf(bitmap: Bitmap): Float32Array {
  return distanceField(bitmap)
}

/** 片側だけの平均距離。線のあるマスから、相手の線までどれだけ離れているか */
function oneWay(bitmap: Bitmap, field: Float32Array): number {
  let total = 0
  let count = 0
  for (let i = 0; i < bitmap.length; i += 1) {
    if (!bitmap[i]) continue
    total += field[i]
    count += 1
  }
  return count === 0 ? SIZE : total / count
}

/** 両方向の平均。小さいほど近い(0 でぴったり) */
export function chamfer(
  a: { bitmap: Bitmap; field: Float32Array },
  b: { bitmap: Bitmap; field: Float32Array },
): number {
  return (oneWay(a.bitmap, b.field) + oneWay(b.bitmap, a.field)) / 2
}
