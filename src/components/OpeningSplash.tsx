import { useEffect, useState } from 'react'
import { LOGO_SOURCES } from '@/assets/logos'
import { markOpeningShown } from '@/services/openingSession'
import { BloomLogo } from './BloomLogo'

/**
 * ロゴを画面に出してから花が開き始めるまでの間。
 * 0 にすると、ページの読み込みとアニメーションが重なって
 * 「見えたときにはもう半分終わっている」状態になる。
 */
const LEAD_IN_MS = 600
/** bloomstudy_icon.svg の動きが完成形に達するまで(dur 2.4s × 文字が出そろう keyTimes 0.5417) */
const LOGO_MOTION_MS = 1300
/** 完成したロゴを見せておく時間 */
const HOLD_MS = 500
const FADE_MS = 400

type Phase = 'lead-in' | 'playing' | 'leaving'

/**
 * 起動時のオープニング演出。
 * 少し間を置いてから縦組みロゴを全画面で1回再生し、フェードアウトして本編に渡す。
 */
export function OpeningSplash({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<Phase>('lead-in')

  useEffect(() => {
    let cancelled = false

    // SVGの取得だけ先に済ませておく。<img> で先読みするとSMILの時計が
    // 表示前に動き出してしまうため、画像ではなく fetch で温める。
    const warmUp = fetch(LOGO_SOURCES.vertical.animated).catch(() => undefined)
    const waited = new Promise((resolve) => window.setTimeout(resolve, LEAD_IN_MS))

    void Promise.all([warmUp, waited]).then(() => {
      if (!cancelled) setPhase('playing')
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    const id = window.setTimeout(() => setPhase('leaving'), LOGO_MOTION_MS + HOLD_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'leaving') return
    const id = window.setTimeout(() => {
      markOpeningShown()
      onFinish()
    }, FADE_MS)
    return () => window.clearTimeout(id)
  }, [phase, onFinish])

  return (
    <div
      // 演出であって情報ではないので支援技術からは隠す
      aria-hidden="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-base-50 transition-opacity duration-[400ms] ${
        phase === 'leaving' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* lead-in のあいだはマウントしない。<img> は挿入された時点でSMILが動き出すため */}
      {phase !== 'lead-in' && (
        <BloomLogo variant="vertical" animated className="w-64 max-w-[70vw]" />
      )}
    </div>
  )
}
