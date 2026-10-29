import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { PlayFinished, PlayProgress } from '@/components/PlayFrame'
import { TraceCanvas } from '@/components/TraceCanvas'
import {
  ENDLESS_TRACE_SETS,
  isTraceSet,
  traceRound,
  traceSession,
  type TraceItem,
} from '@/features/trace'
import { useCopy } from '@/hooks/useAudienceMode'

/** 「できた!」を見せておく時間(ms)。押さなくても次へ進む */
const CELEBRATE_MS = 1100

/**
 * なぞりがき。こども向けのあそびで、おとなが小1・2の漢字を選んだときもここに来る。
 *
 * 字を書けない・読めない年齢も来るので、こたえかたも難易度も選ばせず、
 * 押したらすぐ始まる。正誤も出さない。なぞれたら次、それだけ。
 *
 * 1回ぶんは数問で終わらせて、終わりの画面に必ず届かせる。
 * 終わりの見えない出題は、小さい子には達成感にならない。
 * 進み具合と終わりの見せ方は、モードで変える(PlayFrame)。
 */
export function TracePage() {
  const { setId } = useParams<{ setId: string }>()
  const copy = useCopy()

  /** やめるまで続けるか(漢字)。続けるときは、出し切る前に次の一巡を足していく */
  const endless = isTraceSet(setId) && ENDLESS_TRACE_SETS.includes(setId)
  const [items, setItems] = useState<TraceItem[]>(() =>
    isTraceSet(setId) ? (endless ? traceRound(setId) : traceSession(setId)) : [],
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
      // 続けるときは、最後の字の次に混ぜ直した一巡を足す(終わりの画面には行かない)
      if (endless && index + 1 >= items.length) setItems((current) => [...current, ...traceRound(setId)])
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
        <PlayFinished onRestart={restart} />
      </AppShell>
    )
  }

  return (
    <AppShell fitViewport exitTo="/genres">
      <PlayProgress total={endless ? undefined : items.length} done={index} />

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
