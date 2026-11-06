import { chamfer, fieldOf } from './distance'
import { digitsModel, lettersModel } from './model'
import { nearestPersonal, personalSamples } from './personal'
import { MODEL_SIZE, normalize, normalizeGray, type Bitmap } from './preprocess'
import { predict, type Weights } from './net'
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
  /** どの見本で当たったか。common = みんな共通のお手本・モデル、personal = 自分の字 */
  source?: 'common' | 'personal'
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
export function guessDigit(image: ImageData, candidates: string[]): Promise<Guess[]> {
  return guessByModel(image, candidates, digitsModel)
}

/**
 * 英字(小文字)を学習したモデルで読む。
 *
 * お手本と重ねる方式では、手書きの a が書体の a と形が違うため m に、b が k に読まれていた
 * (試し場で送った字で 2/15)。手書きの英字(EMNIST)で学習したモデルに任せる。
 */
export function guessLetter(image: ImageData, candidates: string[]): Promise<Guess[]> {
  return guessByModel(image, candidates, lettersModel)
}

async function guessByModel(
  image: ImageData,
  candidates: string[],
  model: () => Promise<Weights>,
): Promise<Guess[]> {
  const pixels = normalizeGray(image)
  if (!pixels) return []
  return guessGray(pixels, candidates, await model())
}

function guessGray(pixels: Float32Array, candidates: string[], weights: Weights): Guess[] {
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
  return guessBitmap({ bitmap, field: fieldOf(bitmap) }, candidates)
}

function guessBitmap(written: { bitmap: Bitmap; field: Float32Array }, candidates: string[]): Guess[] {
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

/**
 * 自分の見本との距離を、確からしさ(0〜1)へ写すときの目安。
 *
 * 試し場で送った手書きの字で測ると、同じ字どうしは 0.12〜0.85(9割が 0.51 以下)、
 * 違う字どうしは 0.71〜2.4(中央 1.8)だった。0.5 あたりまでを「同じ字」と見て、
 * それより離れるとすぐ 0 に近づく形(exp(-(距離/目安)²))にする。
 *
 * 書体のお手本用の SCALE(3)のように緩くすると、違う字の見本でも 0.7 近くになり、
 * モデルが少し迷っただけの字を、覚えた別の字が横取りしていた(a〜e を覚えると、
 * 書体の a〜z の正解が 23 → 18 に落ちた)。
 */
const PERSONAL_SCALE = 0.5

/**
 * 共通の読み方に、自分の字(端末の中で覚えた見本)を混ぜて読む。
 *
 * 候補ごとに「共通の答えか、自分の見本のどちらかが、この字だと言っている」確からしさを出す
 * (1 - (1 - 共通) × (1 - 自分の見本))。自分の見本にぴったりなら、共通が迷っていても上がり、
 * 自分の見本から遠ければ、共通の答えがそのまま残る。
 *
 * base: 'digits' / 'letters' は学習したモデル、'template' は書体のお手本(漢字など、モデルの無い字)。
 */
export async function guessWithPersonal(
  image: ImageData,
  candidates: string[],
  base: 'digits' | 'letters' | 'template',
): Promise<Guess[]> {
  const common =
    base === 'digits'
      ? await guessDigit(image, candidates)
      : base === 'letters'
        ? await guessLetter(image, candidates)
        : guess(image, candidates)
  const bitmap = normalize(image)
  if (!bitmap) return common
  const nearest = nearestPersonal({ bitmap, field: fieldOf(bitmap) }, await personalSamples(), candidates)
  return mergePersonal(common, nearest)
}

function mergePersonal(common: Guess[], nearest: Map<string, number>): Guess[] {
  const byLabel = new Map<string, Guess>(common.map((entry) => [entry.label, { ...entry, source: 'common' }]))
  for (const [label, distance] of nearest) {
    const personal = Math.exp(-((distance / PERSONAL_SCALE) ** 2))
    const current = byLabel.get(label)
    const score = 1 - (1 - (current?.score ?? 0)) * (1 - personal)
    // どちらが効いたかは、大きいほうで決める(試し場で「自分の字」と出すため)
    const source = personal > (current?.score ?? 0) ? 'personal' : 'common'
    byLabel.set(label, { label, score, distance: Math.min(distance, current?.distance ?? distance), source })
  }
  return [...byLabel.values()].sort((a, b) => b.score - a.score)
}

/**
 * 覚えた見本を1枚ずつ伏せて、残りで読めるかを測る(leave-one-out)。
 *
 * 「あと何枚書けば当たるようになるか」を、新しく書かなくても確かめられる。
 * 共通の側は、読むときと同じもの(base)で読む。
 */
export async function leaveOneOut(
  candidates: string[],
  base: 'digits' | 'letters' | 'template',
): Promise<{ total: number; hits: number; byLabel: Map<string, { total: number; hits: number }> }> {
  const samples = (await personalSamples()).filter((sample) => candidates.includes(sample.label))
  const weights = base === 'digits' ? await digitsModel() : base === 'letters' ? await lettersModel() : null
  const byLabel = new Map<string, { total: number; hits: number }>()
  let hits = 0
  for (const sample of samples) {
    const nearest = nearestPersonal(sample, samples, candidates, sample.id)
    const common = weights ? guessGray(sample.gray, candidates, weights) : guessBitmap(sample, candidates)
    const [best] = mergePersonal(common, nearest)
    const hit = best?.label === sample.label
    if (hit) hits += 1
    const entry = byLabel.get(sample.label) ?? { total: 0, hits: 0 }
    byLabel.set(sample.label, { total: entry.total + 1, hits: entry.hits + (hit ? 1 : 0) })
  }
  return { total: samples.length, hits, byLabel }
}
