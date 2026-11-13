import { createPortal } from 'react-dom'
import { CORNER, ORDER, useStaffGesture, type Corner } from '@/hooks/useStaffGesture'

const PLACE: Record<Corner, string> = {
  'top-right': 'top-0 right-0',
  'bottom-right': 'right-0 bottom-0',
  'bottom-left': 'bottom-0 left-0',
  'top-left': 'top-0 left-0',
}

/**
 * 隠しページ(スタッフ用)の入口。画面の四隅を、右上から時計回りに1回ずつ押すと開く(useStaffGesture)。
 *
 * 四隅には色を付けない(お客さんに気づかれないように)。押す場所は透明な四角で受ける。
 *
 * - 隅を押したときは、下にあるボタンは反応させない(右上の「こども」の切り替えに重なり、
 *   隅を押すとモードまで切り替わって、こども向けの画面へ移ってしまった)
 * - body の直下に置く。画面の中に置くと、動きを付けた枠を基準に fixed が効いて、
 *   iPad で四角が画面の隅からずれた(上の2つがヘッダーの横に出た)
 */
export function StaffCorners() {
  useStaffGesture()
  return createPortal(
    <>
      {ORDER.map((corner) => (
        <div
          key={corner}
          aria-hidden="true"
          // 押した場所の数え方は useStaffGesture が受け持つ。ここは下のボタンへ通さないだけ
          onClick={(event) => event.stopPropagation()}
          className={`fixed z-50 ${PLACE[corner]}`}
          style={{ width: CORNER, height: CORNER }}
        />
      ))}
    </>,
    document.body,
  )
}
