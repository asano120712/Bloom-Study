import { chamfer, fieldOf } from './distance'
import { digitsModel } from './model'
import { MODEL_SIZE, normalize, normalizeGray } from './preprocess'
import { predict } from './net'
import { templatesOf } from './templates'

export { SIZE, normalize, type Bitmap } from './preprocess'

/**
 * 手書きの読み取り。
 *
 * **ここが唯一の入口。** 中身はいま「お手本と重ねて比べる」だけだが、
 * 学習したモデルに差し替えても、呼ぶ側はこの形のままでよい。
 */
export interface Guess {
  label: string
  /** 0〜1。高いほど近い。候補どうしの比較にだけ使い、絶対値に意味は持たせない */
  score: number
  /** そろえた字とお手本の平均距離(マス単位)。小さいほど近い */
  distance: number
}

/**
 * 距離を 0〜1 に写すときの目安。
 *
 * 32マスの中で平均3マスずれていれば、別の字と見てよい、という感覚で置いてある。
 * しきい値そのものは呼ぶ側(判定)が決めるので、ここは並べ替えのための目安。
 */
const SCALE = 3

/**
 * 学習したモデルで読む(数字だけ)。
 *
 * お手本と重ねる方式は、合成したきれいな線なら当たるが、**実際の指書きでは
 * 4↔9、7↔1、b↔k が入れ替わった**(1のひげ、7の横棒のような手書き特有の形が
 * フォントの字形には無いため)。手書きの字そのもので学習したモデルに任せる。
 *
 * candidates は「出てほしい候補」。答えが分かっているので、
 * 10個すべてではなく1つだけ渡してもよい。
 */
export async function guessDigit(image: ImageData, candidates: string[]): Promise<Guess[]> {
  const pixels = normalizeGray(image)
  if (!pixels) return []

  const weights = await digitsModel()
  const probabilities = predict(weights, pixels, MODEL_SIZE)

  return weights.labels
    .map((label, index) => ({
      label,
      score: probabilities[index],
      // 距離は照合方式との互換のため。確からしさが高いほど0に近づける
      distance: 1 - probabilities[index],
    }))
    .filter((entry) => candidates.includes(entry.label))
    .sort((a, b) => b.score - a.score)
}

/**
 * マスに並べて書いた数を読む。
 *
 * 空のマスは飛ばして、書いてあるものだけを左から順につなぐ
 * (マスは入りうる桁数ぶん出ているので、右に寄せて書いても読める)。
 *
 * confidence は**いちばん自信の無いマス**の値。1字でも怪しければ、
 * 全体として怪しいものとして扱いたい。
 */
export async function readCells(
  cells: ImageData[],
): Promise<{ text: string; confidence: number }> {
  let text = ''
  let confidence = 1

  for (const cell of cells) {
    const [best] = await guessDigit(cell, DIGITS)
    if (!best) continue // 何も書かれていないマス
    text += best.label
    confidence = Math.min(confidence, best.score)
  }

  return { text, confidence }
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * マス1つの絵から、候補を確からしい順に返す(お手本と重ねる方式)。
 *
 * 学習したモデルが無い文字(漢字など)のための道として残してある。
 */
export function guess(image: ImageData, candidates: string[]): Guess[] {
  const bitmap = normalize(image)
  if (!bitmap) return []

  const written = { bitmap, field: fieldOf(bitmap) }

  return candidates
    .map((label) => {
      const distance = templatesOf(label).reduce(
        (best, template) => Math.min(best, chamfer(written, template)),
        Number.POSITIVE_INFINITY,
      )
      return { label, distance, score: Math.exp(-distance / SCALE) }
    })
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)
}
