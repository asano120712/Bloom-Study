/**
 * 書いた字を、比べられる形にそろえる。
 *
 * 指で書いた字は、大きさも位置も線の太さもばらつく。そのまま重ねても一致しないので、
 * **余白を切る → 正方形に収める → 一定の大きさへ縮める → 重心を中央へ**まで揃えてから比べる。
 * 手書き数字の認識で昔から使われている手順(MNIST の前処理)と同じ考え方。
 */

/** そろえたあとの一辺。32 あれば数字・英字の形は見分けられ、距離計算も軽い */
export const SIZE = 32
/** まわりに空ける余白。端に寄った字でも、ずれを吸収できるようにする */
const PADDING = 3
/** 線とみなす不透明度。薄い縁(アンチエイリアス)は拾わない */
const INK_ALPHA = 48
/** 縮めたあと、線とみなす濃さ。細い線が消えないよう低めにしてある */
const INK_COVERAGE = 0.12

/** そろえ終わった字。0 か 1 が SIZE × SIZE 並ぶ */
export type Bitmap = Uint8Array

/**
 * 学習したモデルに渡すときの大きさ。
 *
 * MNIST の作り方に合わせてある(28×28 の中に、字を 20×20 に収めて重心を中央へ)。
 * ここを変えると学習時と条件が変わり、精度が落ちる。
 */
export const MODEL_SIZE = 28
const MODEL_BOX = 20

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** 線のある範囲。何も書かれていなければ null */
function boundsOf(image: ImageData): Bounds | null {
  let left = image.width
  let top = image.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] < INK_ALPHA) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  return right < 0 ? null : { left, top, right, bottom }
}

/**
 * 書いた絵を SIZE × SIZE の白黒へ。
 *
 * 縦横の比は保つ(つぶすと 1 と 0 が似てしまう)。縮めるときは、
 * 元の何ピクセルが線だったかの割合で決める。1ピクセルの線が消えないよう、
 * 割合のしきいは低めにしてある。
 */
/** 字のあるところだけを、指定の大きさに縮めた濃さの格子 */
interface Resampled {
  cells: Float32Array
  width: number
  height: number
}

/** Python の round() と同じ丸め(ちょうど半分なら偶数へ)。学習側と1ピクセルもずらさないため */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value)
  const rest = value - floor
  if (rest !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

function resample(image: ImageData, box: number): Resampled | null {
  const bounds = boundsOf(image)
  if (!bounds) return null

  const width = bounds.right - bounds.left + 1
  const height = bounds.bottom - bounds.top + 1
  const scale = box / Math.max(width, height)

  // 縮めた先の1マスが、元の何ピクセルぶんか
  const step = 1 / scale
  const drawnWidth = Math.max(1, roundHalfEven(width * scale))
  const drawnHeight = Math.max(1, roundHalfEven(height * scale))

  // 数える範囲は学習側(scripts/train/preprocess.py)の切り出しと1ピクセルまで揃える。
  // 端の1列を余分に数えるだけで確からしさが 0.70 → 0.94 に動いた字があった
  const cells = new Float32Array(drawnWidth * drawnHeight)
  for (let y = 0; y < drawnHeight; y += 1) {
    for (let x = 0; x < drawnWidth; x += 1) {
      const fromX = x * step
      const fromY = y * step
      let ink = 0
      let seen = 0
      for (let sy = Math.floor(fromY); sy < Math.floor(Math.min(height, fromY + step)); sy += 1) {
        for (let sx = Math.floor(fromX); sx < Math.floor(Math.min(width, fromX + step)); sx += 1) {
          seen += 1
          const at = ((bounds.top + sy) * image.width + bounds.left + sx) * 4 + 3
          if (image.data[at] >= INK_ALPHA) ink += 1
        }
      }
      cells[y * drawnWidth + x] = seen === 0 ? 0 : ink / seen
    }
  }

  return { cells, width: drawnWidth, height: drawnHeight }
}

/**
 * 重心が中央に来るような置き場所。
 *
 * 囲みの中心ではなく重心に合わせるのは、字の重みの偏り(4 の左下、7 の右上)まで
 * そろえるため。MNIST の作り方と同じ。
 */
function offsetOf(sheet: Resampled, size: number, threshold: number): { x: number; y: number } | null {
  let sumX = 0
  let sumY = 0
  let weight = 0
  for (let y = 0; y < sheet.height; y += 1) {
    for (let x = 0; x < sheet.width; x += 1) {
      const value = sheet.cells[y * sheet.width + x]
      if (value < threshold) continue
      sumX += x * value
      sumY += y * value
      weight += value
    }
  }
  if (weight === 0) return null

  return {
    x: roundHalfEven(size / 2 - sumX / weight),
    y: roundHalfEven(size / 2 - sumY / weight),
  }
}

/** お手本と重ねて比べるための白黒。SIZE × SIZE の 0/1 */
export function normalize(image: ImageData): Bitmap | null {
  const sheet = resample(image, SIZE - PADDING * 2)
  if (!sheet) return null
  const offset = offsetOf(sheet, SIZE, INK_COVERAGE)
  if (!offset) return null

  const bitmap = new Uint8Array(SIZE * SIZE)
  for (let y = 0; y < sheet.height; y += 1) {
    for (let x = 0; x < sheet.width; x += 1) {
      if (sheet.cells[y * sheet.width + x] < INK_COVERAGE) continue
      const toX = x + offset.x
      const toY = y + offset.y
      if (toX < 0 || toY < 0 || toX >= SIZE || toY >= SIZE) continue
      bitmap[toY * SIZE + toX] = 1
    }
  }
  return bitmap
}

/**
 * 学習したモデルに渡すための濃淡。MODEL_SIZE × MODEL_SIZE の 0〜1。
 * 白黒に落とさないのは、学習に使う画像(MNIST)が濃淡で、縁の濃さまで手がかりになるため。
 */
export function normalizeGray(image: ImageData): Float32Array | null {
  const sheet = resample(image, MODEL_BOX)
  if (!sheet) return null
  const offset = offsetOf(sheet, MODEL_SIZE, 0.05)
  if (!offset) return null

  const pixels = new Float32Array(MODEL_SIZE * MODEL_SIZE)
  for (let y = 0; y < sheet.height; y += 1) {
    for (let x = 0; x < sheet.width; x += 1) {
      const value = sheet.cells[y * sheet.width + x]
      if (value <= 0) continue
      const toX = x + offset.x
      const toY = y + offset.y
      if (toX < 0 || toY < 0 || toX >= MODEL_SIZE || toY >= MODEL_SIZE) continue
      pixels[toY * MODEL_SIZE + toX] = value
    }
  }
  return pixels
}
