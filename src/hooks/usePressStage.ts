import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/utils/motion'

/**
 * スタンプを押す演出の段階。
 * - before: 押す前(マスは空けて光らせておく)
 * - hold: スタンプがマスの上に大きく浮かび、ゆれながら力をためる
 * - press: 上からドンと押す
 */
export type PressStage = 'before' | 'hold' | 'press'

/**
 * ためている時間(ms)。すぐ押すと「いつのまにか押されていた」になり、押される瞬間を待てない。
 * 2秒ほど浮かせて、押す前のわくわくを作る。
 */
const HOLD_MS = 2000
/** 押し始めてから、押し終わるまで(着地 360ms + はずみ・にじみ) */
const PRESS_MS = 1100
/** 押し始めてから、マスに着地するまで */
const LAND_MS = 360

/**
 * 押す演出の段階を進める。before で waitMs 待ち、hold でためてから press に移り、
 * 押し終わったら onDone を呼ぶ。動きを減らす設定では、待たずにすぐ押し終える。
 */
export function usePressStage(active: boolean, waitMs: number, onDone: () => void): PressStage | undefined {
  const [stage, setStage] = useState<PressStage | 'done' | undefined>(active ? 'before' : undefined)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!active) return
    const still = prefersReducedMotion()
    const at = (ms: number) => (still ? 0 : ms)
    const timers = [
      window.setTimeout(() => setStage('hold'), at(waitMs)),
      window.setTimeout(() => setStage('press'), at(waitMs + HOLD_MS)),
      // 着地に合わせて、手の中で軽く震わせる(使えない端末では何もしない)
      window.setTimeout(() => navigator.vibrate?.(40), at(waitMs + HOLD_MS + LAND_MS)),
      window.setTimeout(() => {
        setStage('done')
        done.current()
      }, at(waitMs + HOLD_MS + PRESS_MS)),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [active, waitMs])

  // 押し終わったあとは、ふつうのスタンプとして出す
  return stage === 'done' ? undefined : stage
}
