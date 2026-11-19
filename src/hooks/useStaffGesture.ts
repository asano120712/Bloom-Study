import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** 隠しページ(スタッフ用)の場所 */
export const STAFF_PATH = '/staff'

/** 隅とみなす広さ(画面の端からの px)。押しやすさと、下のボタンにかからないことの兼ね合い */
export const CORNER = 64
/** 4回押し終えるまでの時間(ms)。ゆっくり押してもよいが、偶然そろうことは無いくらい */
const WITHIN_MS = 6000

export type Corner = 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'
/**
 * 左上から時計回りに1回ずつ。
 * 右上にはお知らせのボタンがあるので、そこから始めると、お客さんがお知らせを押すたびに
 * 数え始めることになり、隅で受け止めるとお知らせが開けなくなる。
 * 左上から始めれば、右上の隅を受け止めるのは手順の途中だけで済む(StaffCorners)。
 */
export const ORDER: Corner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

function cornerOf(x: number, y: number): Corner | null {
  const right = x >= window.innerWidth - CORNER
  const left = x <= CORNER
  const top = y <= CORNER
  const bottom = y >= window.innerHeight - CORNER
  if (top && right) return 'top-right'
  if (bottom && right) return 'bottom-right'
  if (bottom && left) return 'bottom-left'
  if (top && left) return 'top-left'
  return null
}

/**
 * 画面の四隅を、左上から時計回りに1回ずつ押すと、隠しページ(スタッフ用)を開く。
 *
 * 文化祭でお客さんが触るので、記録を消すようなボタンは画面に出さず、ここからだけ入れるようにする。
 * 入口はホーム画面とジャンル選択画面で足りるので、その画面だけがこれを使う。
 * 途中で違う場所を押したら、最初からやり直し。隅の下のボタンを止めるのは StaffCorners が受け持つ。
 *
 * 返り値は「手順の途中か」。途中のあいだだけ、右上の隅でお知らせのボタンを止めるのに使う。
 */
export function useStaffGesture(): boolean {
  const navigate = useNavigate()
  const [isInProgress, setIsInProgress] = useState(false)

  useEffect(() => {
    let step = 0
    let startedAt = 0
    /** 時間切れで手順を捨てる。押さずに放っておかれても、右上を止めたままにしない */
    let expireTimer: number | undefined
    const sync = () => {
      window.clearTimeout(expireTimer)
      setIsInProgress(step > 0)
      if (step > 0) {
        expireTimer = window.setTimeout(() => {
          step = 0
          setIsInProgress(false)
        }, startedAt + WITHIN_MS - Date.now())
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const corner = cornerOf(event.clientX, event.clientY)
      const now = Date.now()
      if (step > 0 && now - startedAt > WITHIN_MS) step = 0
      if (corner === ORDER[step]) {
        if (step === 0) startedAt = now
        step += 1
        if (step === ORDER.length) {
          step = 0
          sync()
          navigate(STAFF_PATH)
          return
        }
      } else {
        // 違う場所を押したらやり直し。ただし左上なら、そこから数え直す
        step = corner === ORDER[0] ? 1 : 0
        if (step === 1) startedAt = now
      }
      sync()
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      window.clearTimeout(expireTimer)
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [navigate])

  return isInProgress
}
