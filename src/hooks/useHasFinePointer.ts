import { useEffect, useState } from 'react'

/**
 * マウス・トラックパッドで操作している(=物理キーボードがある)端末かどうか。
 *
 * 画面幅で判定すると、キーボードを持たない大きめのタブレットで
 * 画面キーボードが消えて入力手段が無くなる。ポインタの種類で見るほうが確実。
 */
const QUERY = '(hover: hover) and (pointer: fine)'

export function useHasFinePointer(): boolean {
  // 判定できない環境では false = 画面キーボードを出す(入力できなくなるより安全)
  const [hasFinePointer, setHasFinePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true,
  )

  useEffect(() => {
    const media = window.matchMedia?.(QUERY)
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => setHasFinePointer(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return hasFinePointer
}
