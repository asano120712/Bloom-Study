import { useLayoutEffect, type RefObject } from 'react'

/**
 * 筆算のマスを、置く場所に入る最大の大きさにする(手書きのマスにも、数字キーボードの筆算にも使う)。
 *
 * 筆算の高さと幅は、マスの大きさにほぼ比例する(字の大きさもマスに合わせてあるため)。
 * 残りは線やすきまのような決まった大きさなので、**2つの大きさで実際に置いて測り**、
 * 「大きさ = 傾き × マス + 決まった分」を出してから、置く場所に収まる最大のマスを逆算する。
 * 式の行数・途中の段の数・画面の大きさで答えが変わるので、決め打ちの上限より無駄が出ない。
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

      const at = (size: number) => {
        box.style.setProperty('--fit-cell', `${size}px`)
        return {
          height: content.getBoundingClientRect().height,
          width: widest.getBoundingClientRect().width,
        }
      }
      const [small, large] = [40, 80]
      const a = at(small)
      const b = at(large)
      const slope = {
        height: (b.height - a.height) / (large - small),
        width: (b.width - a.width) / (large - small),
      }
      const fixed = { height: a.height - slope.height * small, width: a.width - slope.width * small }

      const byHeight = (box.clientHeight - fixed.height) / slope.height
      const byWidth = (box.clientWidth - fixed.width) / slope.width
      const size = Math.floor(Math.min(byHeight, byWidth, max))
      box.style.setProperty('--fit-cell', `${Math.max(min, size)}px`)
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
