import { useEffect, type RefObject } from 'react'

/**
 * 書く場所の上では、ブラウザの長押し・拡大などの動きを止める。
 *
 * iPhone・iPad の Safari は、書いている途中で指が止まると長押しと受け取り、
 * 拡大鏡や「コピー・リンクをコピー」のメニュー(今のページの URL つき)を出す。
 * CSS の `-webkit-touch-callout: none` や `touch-action: none`、pointerdown の
 * preventDefault だけでは止まらない(iOS 15 以降は、選択を止めたキャンバスでも出る)。
 * 長押しはタッチの側で始まるので、touchstart / touchmove で止める。
 * Apple Pencil の線がスクリブル(手書き入力)に取られて途切れるのも、touchmove を止めると収まる。
 *
 * React の onTouchStart は passive で登録され preventDefault が効かないため、
 * 要素に直接 `passive: false` で付ける。
 * 指でも Pencil でも pointer イベントはそのまま届くので、書く処理には影響しない。
 *
 * @param selector 指定すると、その要素(例: 'canvas')の上で始まったタッチだけを止める。
 *   ボタンも入っている枠に付けるときに使う(止めるとボタンのタップも効かなくなるため)
 */
export function useNoTouchGesture(ref: RefObject<Element | null>, selector?: string) {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const stop = (event: Event) => {
      if (selector && !(event.target instanceof Element && event.target.closest(selector))) return
      if (event.cancelable) event.preventDefault()
    }
    // gesturestart は Safari だけのピンチ操作。書いている途中の2本指で画面が拡大されないように
    const types = ['touchstart', 'touchmove', 'contextmenu', 'gesturestart']
    for (const type of types) element.addEventListener(type, stop, { passive: false })
    return () => {
      for (const type of types) element.removeEventListener(type, stop)
    }
  }, [ref, selector])
}
