/**
 * 種を決めた並べ替え。
 *
 * 描画中に Math.random() を呼ぶと、再描画のたびに結果が変わりうる
 * (押そうとした瞬間に選択肢が入れ替わる)。同じ入力から必ず同じ順序を作る。
 */
function hashCode(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32。種から同じ乱数列を再現できる小さな生成器 */
function randomFrom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** seed が同じなら常に同じ並びを返す */
export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const random = randomFrom(hashCode(seed))
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
