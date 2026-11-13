import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** 隠しページ(スタッフ用)の場所 */
export const STAFF_PATH = '/staff'

/** 隅とみなす広さ(画面の端からの px)。押しやすさと、下のボタンにかからないことの兼ね合い */
export const CORNER = 64
/** 4回押し終えるまでの時間(ms)。ゆっくり押してもよいが、偶然そろうことは無いくらい */
const WITHIN_MS = 6000

export type Corner = 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'
/** 右上から時計回りに1回ずつ */
export const ORDER: Corner[] = ['top-right', 'bottom-right', 'bottom-left', 'top-left']

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
 * 画面の四隅を、右上から時計回りに1回ずつ押すと、隠しページ(スタッフ用)を開く。
 *
 * 文化祭でお客さんが触るので、記録を消すようなボタンは画面に出さず、ここからだけ入れるようにする。
 * 入口はホーム画面とジャンル選択画面で足りるので、その画面だけがこれを使う。
 * 途中で違う場所を押したら、最初からやり直し。隅の下のボタンを止めるのは StaffCorners が受け持つ。
 */
export function useStaffGesture(): void {
  const navigate = useNavigate()

  useEffect(() => {
    let step = 0
    let startedAt = 0
    const onPointerDown = (event: PointerEvent) => {
      const corner = cornerOf(event.clientX, event.clientY)
      const now = Date.now()
      if (step > 0 && now - startedAt > WITHIN_MS) step = 0
      if (corner === ORDER[step]) {
        if (step === 0) startedAt = now
        step += 1
        if (step === ORDER.length) {
          step = 0
          navigate(STAFF_PATH)
          return
        }
      } else {
        // 違う場所を押したらやり直し。ただし右上なら、そこから数え直す
        step = corner === ORDER[0] ? 1 : 0
        if (step === 1) startedAt = now
      }
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [navigate])
}
