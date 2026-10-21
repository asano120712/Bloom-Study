import { fieldOf } from './distance'
import { normalize, type Bitmap } from './preprocess'

/**
 * お手本。候補の文字を画面の外で描いて、書いた字と同じ手順でそろえたもの。
 *
 * **学習をしないで済ませるための土台。** 「この字は何か」を当てるのではなく、
 * 「この字は 7 か?」を見るだけなら、7 を描いて重ねれば足りる。
 *
 * 1字につき複数の書体を持つのは、同じ数字でも形が割れるため
 * (1 のひげ、7 の横棒、4 の閉じ・開き)。いちばん近い書体との距離を採る。
 * 足りなければ、ここに**自分で書いた字**を足していく。
 */

/** 描く大きさ。書いたマスの描画バッファ(120)と揃えておく */
const CANVAS = 120

/**
 * お手本に使う書体。
 *
 * 端末にある書体は限られるので、総称名で頼む(無ければ既定の書体で描かれる)。
 * 形の割れを拾うのが目的なので、字の作りが違うものを並べてある。
 */
const FACES = ['sans-serif', 'serif', 'monospace', 'cursive']

export interface Template {
  label: string
  bitmap: Bitmap
  field: Float32Array
}

/** 一度作ったお手本は使い回す。描くたびに canvas を起こすと重い */
const cache = new Map<string, Template[]>()

function draw(label: string, face: string): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS
  canvas.height = CANVAS
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#000000'
  // 余白は前処理で切るので、はみ出さない範囲で大きく描く
  context.font = `${Math.round(CANVAS * 0.8)}px ${face}`
  context.fillText(label, CANVAS / 2, CANVAS / 2)

  return context.getImageData(0, 0, CANVAS, CANVAS)
}

export function templatesOf(label: string): Template[] {
  const cached = cache.get(label)
  if (cached) return cached

  const made: Template[] = []
  for (const face of FACES) {
    const image = draw(label, face)
    if (!image) continue
    const bitmap = normalize(image)
    if (!bitmap) continue
    // 同じ形になった書体は捨てる(距離の計算をそのぶん減らせる)
    if (made.some((template) => sameShape(template.bitmap, bitmap))) continue
    made.push({ label, bitmap, field: fieldOf(bitmap) })
  }

  cache.set(label, made)
  return made
}

function sameShape(a: Bitmap, b: Bitmap): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}
