import { useEffect, useState } from 'react'
import { useAudienceMode } from '@/hooks/useAudienceMode'
import { BloomMark } from './BloomMark'

/**
 * 花びらが開閉するローディング表示。
 *
 * 一瞬で終わる読み込みでチラつかないよう、delayMs を過ぎるまでは何も描かない。
 * 数秒以上かかる処理(レベル4の意味的類似度判定モデルの初回読み込みなど)では
 * hint に待ち時間の見込みを添えて、止まって見えないようにする。
 */
export function Loading({
  message = 'よみこみ中',
  hint,
  delayMs = 200,
}: {
  message?: string
  hint?: string
  delayMs?: number
}) {
  const [isVisible, setIsVisible] = useState(delayMs === 0)
  // 花マークはこども向けのときだけ顔つきにする(おとな向けは今までどおり花びらだけ)
  const isKids = useAudienceMode() === 'kids'

  useEffect(() => {
    if (delayMs === 0) return
    const id = window.setTimeout(() => setIsVisible(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])

  if (!isVisible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="m-auto flex flex-col items-center gap-4 py-10 text-center"
    >
      <BloomMark size={64} motion="loop" face={isKids ? 'sleepy' : undefined} />
      <p className="text-base text-ink-600">{message}</p>
      {hint && <p className="max-w-64 text-sm text-ink-400">{hint}</p>}
    </div>
  )
}
