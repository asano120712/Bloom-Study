/**
 * TS 側の推論が、学習側(Python)と同じ答えを出すか確かめる。
 *
 *   python3 scripts/train/export_check.py   # 材料を書き出してから
 *   node scripts/check-recognizer.ts
 *
 * 重みの写し間違い、プーリングの端の扱いのずれは、ここでしか見つからない。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadWeights, predict, type Model } from '../src/features/recognize/net.ts'

const modelPath = fileURLToPath(new URL('../src/data/model.digits.generated.json', import.meta.url))
const checkPath = fileURLToPath(new URL('./train/.cache/check.json', import.meta.url))

const model = JSON.parse(readFileSync(modelPath, 'utf-8')) as Model
const check = JSON.parse(readFileSync(checkPath, 'utf-8')) as {
  pixels: number[][]
  labels: number[]
  prob: number[][]
}

const weights = loadWeights(model)

let worst = 0
let agree = 0
let correct = 0
for (const [index, pixels] of check.pixels.entries()) {
  const mine = predict(weights, Float32Array.from(pixels), 28)
  const theirs = check.prob[index]

  for (let i = 0; i < mine.length; i += 1) worst = Math.max(worst, Math.abs(mine[i] - theirs[i]))

  const myTop = mine.indexOf(Math.max(...mine))
  const theirTop = theirs.indexOf(Math.max(...theirs))
  if (myTop === theirTop) agree += 1
  if (myTop === check.labels[index]) correct += 1
}

console.log(`${check.pixels.length}枚で確認`)
console.log(`  Python と同じ1位: ${agree} / ${check.pixels.length}`)
console.log(`  確からしさの最大のずれ: ${worst.toExponential(2)}`)
console.log(`  TS 側の正解率: ${((correct / check.pixels.length) * 100).toFixed(0)}%`)
