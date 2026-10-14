import { useEffect, useState } from 'react'
import { LOGO_SOURCES } from '@/assets/logos'
import { useAudienceMode } from '@/hooks/useAudienceMode'
import { markOpeningShown } from '@/services/openingSession'
import { BloomLogo } from './BloomLogo'
import { BloomMark } from './BloomMark'
import { LoadingDots } from './LoadingDots'

/**
 * ロゴを画面に出してから花が開き始めるまでの間。
 * 0 にすると、ページの読み込みとアニメーションが重なって
 * 「見えたときにはもう半分終わっている」状態になる。
 */
const LEAD_IN_MS = 600
/**
 * bloomstudy_icon.svg の動きが完成形に達するまで(dur 2.4s × 文字が出そろう keyTimes 0.5417)。
 * こども向けは文字のないマークで、最後の花びらが開き終わるのが約1.1秒。
 * どちらも収まるので、尺はモードで分けずにこの値で通している。
 */
const LOGO_MOTION_MS = 1300
/** 完成したロゴを見せておく時間 */
const HOLD_MS = 500
const FADE_MS = 400
/** 読み込みが返ってこなくても、ここまで待ったら本編に進む */
const MAX_WAIT_MS = 4000

/**
 * 起動時のオープニング演出。
 * 少し間を置いてからロゴを1回再生し、その下でローディングドットを回す。
 * 演出の尺と実際の読み込み(Webフォント)の両方が終わったらフェードアウトする。
 *
 * こども向けはワードマークを出さず、顔つきのマークだけが開く(ヘッダーと揃える)。
 */
export function OpeningSplash({ onFinish }: { onFinish: () => void }) {
  const isKids = useAudienceMode() === 'kids'
  const [hasLogoStarted, setHasLogoStarted] = useState(false)
  const [isTimelineDone, setIsTimelineDone] = useState(false)
  const [isAppReady, setIsAppReady] = useState(false)

  const isLeaving = isTimelineDone && isAppReady

  useEffect(() => {
    let cancelled = false

    // SVGの取得だけ先に済ませておく。<img> で先読みするとSMILの時計が
    // 表示前に動き出してしまうため、画像ではなく fetch で温める。
    // こども向けのマークは画面の中に直接描く(読み込むファイルが無い)ので温める先も無い。
    const warmUp = isKids
      ? Promise.resolve()
      : fetch(LOGO_SOURCES.vertical.animated).catch(() => undefined)
    const waited = new Promise((resolve) => window.setTimeout(resolve, LEAD_IN_MS))

    void Promise.all([warmUp, waited]).then(() => {
      if (!cancelled) setHasLogoStarted(true)
    })

    return () => {
      cancelled = true
    }
  }, [isKids])

  useEffect(() => {
    if (!hasLogoStarted) return
    const id = window.setTimeout(() => setIsTimelineDone(true), LOGO_MOTION_MS + HOLD_MS)
    return () => window.clearTimeout(id)
  }, [hasLogoStarted])

  // ローディングマークを飾りにしないため、実際の待ち(Webフォント)と連動させる
  useEffect(() => {
    const markReady = () => setIsAppReady(true)
    const cap = window.setTimeout(markReady, MAX_WAIT_MS)
    void document.fonts.ready.then(markReady, markReady)
    return () => window.clearTimeout(cap)
  }, [])

  useEffect(() => {
    if (!isLeaving) return
    const id = window.setTimeout(() => {
      markOpeningShown()
      onFinish()
    }, FADE_MS)
    return () => window.clearTimeout(id)
  }, [isLeaving, onFinish])

  return (
    <div
      // 演出であって情報ではないので支援技術からは隠す
      aria-hidden="true"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-base-50 transition-opacity duration-[400ms] ${
        isLeaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* ロゴが出た瞬間にドットが下へずれないよう、最初から場所を取っておく。
          <img> はDOMに挿入された時点でSMILが動き出すため、lead-in 中はマウントしない
          (こども向けのマークも、マウントした時点で開き始めるので同じ扱いにする)。 */}
      <div className="flex aspect-[400/360] w-64 max-w-[70vw] items-center justify-center">
        {hasLogoStarted &&
          (isKids ? (
            <BloomMark face="smile" className="h-full w-auto" />
          ) : (
            <BloomLogo variant="vertical" animated className="w-full" />
          ))}
      </div>

      <LoadingDots />
    </div>
  )
}
