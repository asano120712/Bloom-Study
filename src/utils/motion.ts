/** OSの「視差効果を減らす」設定が有効か。演出を出す前に必ず確認する */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
