import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/utils/motion'

/**
 * スタンプを押す演出の段階。
 * - before: 押す前(マスは空けて光らせておく)
 * - hold: スタンプがマスの上に大きく浮かび、ゆれながら待つ。このあいだに、どのスタンプにするか選んでもらう
 * - lift: 押すボタンを押したあと、スタンプをぐっと持ち上げる
 * - press: 上からドンと押す
 */
export type PressStage = 'before' | 'hold' | 'lift' | 'press'

/** 持ち上げる時間(ms)。index.css の stamp-lift と同じ */
const LIFT_MS = 380
/** 押し始めてから、押し終わるまで(着地 360ms + はずみ・にじみ) */
const PRESS_MS = 1100
/** 押し始めてから、マスに着地するまで */
const LAND_MS = 360

/**
 * 押す演出の段階を進める。before で waitMs 待ってから hold に移り、そこで止まって待つ。
 * 返す press を呼ぶと(押すボタン)、持ち上げてから押し、押し終わったら onDone を呼ぶ。
 * 自動では押さない。どのスタンプにするかを選んでから、自分で押してもらうため。
 * 動きを減らす設定では、待ち時間と動きを飛ばす(選ぶところと押すボタンは同じように出る)。
 */
export function usePressStage(
  active: boolean,
  waitMs: number,
  onDone: () => void,
): { stage: PressStage | undefined; press: () => void } {
  const [stage, setStage] = useState<PressStage | 'done' | undefined>(active ? 'before' : undefined)
  const done = useRef(onDone)
  const timers = useRef<number[]>([])
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setStage('hold'), prefersReducedMotion() ? 0 : waitMs)
    return () => window.clearTimeout(timer)
  }, [active, waitMs])

  // 押している途中で画面を離れたら、残りのタイマーを止める
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])

  const stageRef = useRef(stage)
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const press = useCallback(() => {
    // 待っているときだけ。二度押しや、押している途中のボタンは受けない
    if (stageRef.current !== 'hold') return
    stageRef.current = 'lift'
    setStage('lift')
    const at = (ms: number) => (prefersReducedMotion() ? 0 : ms)
    timers.current = [
      window.setTimeout(() => setStage('press'), at(LIFT_MS)),
      // 着地に合わせて、手の中で軽く震わせる(使えない端末では何もしない)
      window.setTimeout(() => navigator.vibrate?.(40), at(LIFT_MS + LAND_MS)),
      window.setTimeout(() => {
        setStage('done')
        done.current()
      }, at(LIFT_MS + PRESS_MS)),
    ]
  }, [])

  // 押し終わったあとは、ふつうのスタンプとして出す
  return { stage: stage === 'done' ? undefined : stage, press }
}
