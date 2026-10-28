import { loadWeights, type Model, type Weights } from './net'

/**
 * 学習した重みの読み込み。
 *
 * **使うときだけ読む。** 手書きで答える人だけが要るものなので、
 * 問題データと同じく動的 import にしてある(数字 22KB、英字 104KB)。
 */
const loading = new Map<string, Promise<Weights>>()

function once(name: string, load: () => Promise<{ default: unknown }>): Promise<Weights> {
  let found = loading.get(name)
  if (!found) {
    found = load().then((module) => loadWeights(module.default as Model))
    loading.set(name, found)
  }
  return found
}

export function digitsModel(): Promise<Weights> {
  return once('digits', () => import('@/data/model.digits.generated.json'))
}

/** 英字(小文字 a〜z)。EMNIST で学習したもの(scripts/train/train_letters.py) */
export function lettersModel(): Promise<Weights> {
  return once('letters', () => import('@/data/model.letters.generated.json'))
}
