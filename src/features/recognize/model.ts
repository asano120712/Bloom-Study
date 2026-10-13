import { loadWeights, type Model, type Weights } from './net'

/**
 * 学習した重みの読み込み。
 *
 * **使うときだけ読む。** 手書きで答える人だけが要るものなので、
 * 問題データと同じく動的 import にしてある(22KB)。
 */
let loading: Promise<Weights> | null = null

export function digitsModel(): Promise<Weights> {
  if (!loading) {
    loading = import('@/data/model.digits.generated.json').then((module) =>
      loadWeights(module.default as unknown as Model),
    )
  }
  return loading
}
