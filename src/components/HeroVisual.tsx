import { useState } from 'react'
import { HERO_SOURCES } from '@/assets/logos'
import { prefersReducedMotion } from '@/utils/motion'

/**
 * トップに置く挿絵。花がゆっくり回り、ペンが Bloomstudy を書き上げる動きをループする。
 * 動きはSVG内のSMILで完結しているので <img> で読み込む(ロゴと同じ扱い)。
 * 「視差効果を減らす」設定のときは、書き上がった状態の静止版に差し替える。
 */
export function HeroVisual({ className }: { className?: string }) {
  // 表示中に切り替わると再生が巻き戻るため、マウント時の設定で固定する
  const [src] = useState(() =>
    prefersReducedMotion() ? HERO_SOURCES.static : HERO_SOURCES.animated,
  )

  // 内容は下の文章と重なる飾りなので、支援技術からは隠す
  return <img src={src} alt="" aria-hidden="true" className={className} />
}
