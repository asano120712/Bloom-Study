/**
 * 学習した重みで読み取る(前向きの計算だけ)。
 *
 * 層は4種類しかない: 畳み込み / ReLU / 最大プーリング / 全結合。
 * 学習側(scripts/train/net.py)と**同じ順・同じ約束**で書いてある。
 * とくに最大プーリングは、奇数のときに右端・下端を捨てる点を合わせること。
 *
 * ライブラリは使わない。この大きさ(重み約5,200個)なら、素直に書いても1ms以内に終わる。
 */

/** 重みの入れもの。int8 と倍率で持ち、読み込むときに実数へ戻す */
export interface Layer {
  name: string
  shape: number[]
  scale: number
  values: number[]
}

export interface Model {
  labels: string[]
  layers: Layer[]
}

interface Tensor {
  /** チャンネル数 */
  channels: number
  height: number
  width: number
  data: Float32Array
}

function dequantize(layer: Layer): Float32Array {
  const out = new Float32Array(layer.values.length)
  for (let i = 0; i < out.length; i += 1) out[i] = layer.values[i] * layer.scale
  return out
}

/** 3×3 の畳み込み(余白なし)。出力は縦横とも2マス小さくなる */
function conv3(input: Tensor, weights: Float32Array, bias: Float32Array, filters: number): Tensor {
  const height = input.height - 2
  const width = input.width - 2
  const data = new Float32Array(filters * height * width)

  for (let f = 0; f < filters; f += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = bias[f]
        for (let c = 0; c < input.channels; c += 1) {
          for (let ky = 0; ky < 3; ky += 1) {
            for (let kx = 0; kx < 3; kx += 1) {
              const weight = weights[((f * input.channels + c) * 3 + ky) * 3 + kx]
              sum += weight * input.data[(c * input.height + y + ky) * input.width + x + kx]
            }
          }
        }
        data[(f * height + y) * width + x] = sum > 0 ? sum : 0 // relu までここで済ませる
      }
    }
  }
  return { channels: filters, height, width, data }
}

/** 2×2 の最大値。奇数のときは右端・下端を捨てる(学習側と同じ) */
function pool2(input: Tensor): Tensor {
  const height = Math.floor(input.height / 2)
  const width = Math.floor(input.width / 2)
  const data = new Float32Array(input.channels * height * width)

  for (let c = 0; c < input.channels; c += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let best = Number.NEGATIVE_INFINITY
        for (let dy = 0; dy < 2; dy += 1) {
          for (let dx = 0; dx < 2; dx += 1) {
            const value = input.data[(c * input.height + y * 2 + dy) * input.width + x * 2 + dx]
            if (value > best) best = value
          }
        }
        data[(c * height + y) * width + x] = best
      }
    }
  }
  return { channels: input.channels, height, width, data }
}

/** 重みを一度だけ実数へ戻しておく。推論のたびに戻すと無駄 */
export interface Weights {
  labels: string[]
  w1: Float32Array
  b1: Float32Array
  w2: Float32Array
  b2: Float32Array
  w3: Float32Array
  b3: Float32Array
  filters1: number
  filters2: number
}

export function loadWeights(model: Model): Weights {
  const find = (name: string) => {
    const layer = model.layers.find((entry) => entry.name === name)
    if (!layer) throw new Error(`重みが足りない: ${name}`)
    return layer
  }

  return {
    labels: model.labels,
    w1: dequantize(find('w1')),
    b1: dequantize(find('b1')),
    w2: dequantize(find('w2')),
    b2: dequantize(find('b2')),
    w3: dequantize(find('w3')),
    b3: dequantize(find('b3')),
    filters1: find('w1').shape[0],
    filters2: find('w2').shape[0],
  }
}

/** 28×28 の濃淡(0〜1)から、各ラベルの確からしさ(合計1)を出す */
export function predict(weights: Weights, pixels: Float32Array, size: number): number[] {
  const input: Tensor = { channels: 1, height: size, width: size, data: pixels }

  const pooled = pool2(conv3(input, weights.w1, weights.b1, weights.filters1))
  const flat = pool2(conv3(pooled, weights.w2, weights.b2, weights.filters2))

  const labels = weights.labels.length
  const logits = new Float32Array(labels)
  for (let i = 0; i < labels; i += 1) {
    let sum = weights.b3[i]
    for (let j = 0; j < flat.data.length; j += 1) {
      sum += weights.w3[i * flat.data.length + j] * flat.data[j]
    }
    logits[i] = sum
  }

  // softmax。いちばん大きい値を引いてから指数にする(あふれ防止)
  let max = Number.NEGATIVE_INFINITY
  for (const value of logits) if (value > max) max = value
  let total = 0
  const out = new Array<number>(labels)
  for (let i = 0; i < labels; i += 1) {
    out[i] = Math.exp(logits[i] - max)
    total += out[i]
  }
  for (let i = 0; i < labels; i += 1) out[i] /= total
  return out
}
