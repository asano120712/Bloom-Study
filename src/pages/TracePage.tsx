import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'
import { TraceCanvas } from '@/components/TraceCanvas'
import { isTraceSet, traceSession, type TraceItem } from '@/features/trace'
import { useCopy } from '@/hooks/useAudienceMode'

/** 「できた!」を見せておく時間(ms)。押さなくても次へ進む */
const CELEBRATE_MS = 1100

/**
 * なぞりがき(こども向けのあそび)。
 *
 * 字を書けない・読めない年齢を想定しているので、こたえかたも難易度も選ばせず、
 * 押したらすぐ始まる。正誤も出さない。なぞれたら次、それだけ。
 *
 * 1回ぶんは数問で終わらせて「ぜんぶ できた!」に必ず届かせる。
 * 終わりの見えない出題は、この年齢では達成感にならない。
 */
export function TracePage() {
  const { setId } = useParams<{ setId: string }>()
  const copy = useCopy()

  const [items, setItems] = useState<TraceItem[]>(() =>
    isTraceSet(setId) ? traceSession(setId) : [],
  )
  const [index, setIndex] = useState(0)
  /** なぞり終えて「できた!」を見せている間 */
  const [celebrating, setCelebrating] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  if (!isTraceSet(setId)) return <Navigate to="/genres" replace />

  const item = items[index]
  const isFinished = index >= items.length

  const complete = () => {
    setCelebrating(true)
    timer.current = window.setTimeout(() => {
      setCelebrating(false)
      setIndex((current) => current + 1)
    }, CELEBRATE_MS)
  }

  const restart = () => {
    setItems(traceSession(setId))
    setIndex(0)
    setCelebrating(false)
  }

  if (isFinished) {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <BloomMark size={120} face="joy" />
          <p className="text-2xl font-bold text-bloom-700">{copy.play.allDone}</p>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={restart}
              className="flex min-h-16 w-full items-center justify-center rounded-full bg-bloom-700 text-xl font-bold text-white"
            >
              {copy.play.again}
            </button>
            <Link to="/genres" className="text-base text-ink-400 underline">
              {copy.play.other}
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell fitViewport exitTo="/genres">
      {/* できた数を花で出す。数字より、増えていくのが見えるほうが分かりやすい */}
      <div className="flex shrink-0 items-center justify-center gap-2 pt-1">
        {items.map((each, position) => (
          <span
            key={each.id}
            className={`transition-opacity duration-500 ${
              position < index ? '' : 'opacity-20 grayscale'
            }`}
          >
            <BloomMark size={20} motion="none" />
          </span>
        ))}
      </div>

      <p className="mt-3 shrink-0 text-center text-2xl font-bold">{item.label}</p>

      <div className="mt-3 flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-[min(100%,60vh)]">
          <TraceCanvas item={item} onComplete={complete} frozen={celebrating} />
        </div>
      </div>

      <div className="mt-3 flex h-16 shrink-0 items-center justify-center">
        {celebrating ? (
          <p className="animate-bloom-in text-2xl font-bold text-bloom-700">{copy.trace.done}</p>
        ) : (
          <p className="text-center text-base text-ink-600">{copy.trace.guide}</p>
        )}
      </div>
    </AppShell>
  )
}
