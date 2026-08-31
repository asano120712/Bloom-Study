import { useEffect, useState } from 'react'
import { HINT_INTERVAL_MS } from '@/config'

interface HintTimerOptions {
  /** 開放しうるヒントの総数 */
  totalHints: number
  /** 一時停止(解答提出後など) */
  paused?: boolean
  intervalMs?: number
}

interface HintTimer {
  /** 現在開放されているヒント数 */
  revealedCount: number
  /** 次のヒントまでの残り秒数。全て開放済みなら null */
  secondsToNext: number | null
  /** 出題を切り替えたときにタイマーを最初から始め直す */
  restart: () => void
}

const TICK_MS = 250

/**
 * 出題開始から一定間隔ごとにヒントを1つずつ開放するタイマー。
 * 間隔は config の HINT_INTERVAL_MS で調整できる。
 */
export function useHintTimer({
  totalHints,
  paused = false,
  intervalMs = HINT_INTERVAL_MS,
}: HintTimerOptions): HintTimer {
  const [elapsedMs, setElapsedMs] = useState(0)

  const revealedCount = Math.min(Math.floor(elapsedMs / intervalMs), totalHints)
  const isComplete = revealedCount >= totalHints

  useEffect(() => {
    if (paused || isComplete) return

    const id = window.setInterval(() => {
      setElapsedMs((previous) => previous + TICK_MS)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [paused, isComplete])

  return {
    revealedCount,
    secondsToNext: isComplete
      ? null
      : Math.max(0, Math.ceil((intervalMs - (elapsedMs % intervalMs)) / 1000)),
    restart: () => setElapsedMs(0),
  }
}
