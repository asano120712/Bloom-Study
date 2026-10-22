import { useLayoutEffect, type RefObject } from 'react'

/**
 * 筆算のマスを、置く場所に入る最大の大きさにする(手書きのマスにも、数字キーボードの筆算にも使う)。
 *
 * **その大きさで実際に置いて測り**、置く場所に収まる最大のマスを探す。
 * 式の行数・途中の段の数・画面の大きさで答えが変わるので、決め打ちの上限より無駄が出ない。
 *
 * 2つの大きさで測って比例で逆算していたが、筆算の高さはマスにまっすぐ比例しない
 * (小さいうちは下限で止まる部分がある)。小さい側で測った傾きで大きい側を見積もると
 * 低く出て、iPad などでマスの下が十数 px 切れていた。
 *
 * 測る相手は、置く場所(area)の最初の子(高さ)と、`data-fit-width` を付けた筆算(幅)。
 * 決めた大きさは `--fit-cell` として置く場所に渡す。筆算が無い(1行の式など)ときは何もしない。
 *
 * 置く場所の大きさが変わったら(画面を回したとき、ブラウザのバーが出入りしたとき)測り直す。
 */
export function useFitCell(
  area: RefObject<HTMLElement | null>,
  { min, max }: { min: number; max: number },
) {
  useLayoutEffect(() => {
    const box = area.current
    if (!box) return

    const fit = () => {
      const content = box.firstElementChild
      const widest = box.querySelector('[data-fit-width]')
      if (!(content instanceof HTMLElement) || !(widest instanceof HTMLElement)) return

      const fits = (size: number) => {
        box.style.setProperty('--fit-cell', `${size}px`)
        return (
          content.getBoundingClientRect().height <= box.clientHeight &&
          widest.getBoundingClientRect().width <= box.clientWidth
        )
      }
      // 収まる最大の大きさを二分探索で探す(7回ほど置いて測る)
      let size = min
      let over = max + 1
      while (over - size > 1) {
        const middle = Math.floor((size + over) / 2)
        if (fits(middle)) size = middle
        else over = middle
      }
      box.style.setProperty('--fit-cell', `${size}px`)
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    /*
      ウェブフォントの読み込みが終わると、字の幅(「=」や式の数字)が変わる。
      置く場所の大きさは変わらないので ResizeObserver では気づけず、読み込み前の字幅で
      決めたマスのまま、筆算が置く場所からはみ出していた。読み込みが済んだら測り直す。
    */
    let active = true
    void document.fonts?.ready.then(() => {
      if (active) fit()
    })
    document.fonts?.addEventListener('loadingdone', fit)
    return () => {
      active = false
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', fit)
    }
  }, [area, min, max])
}
