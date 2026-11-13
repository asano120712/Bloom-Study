import type { CSSProperties, ReactNode } from 'react'

/** 手書きのときのマス。書く場所に入る最大の大きさ(BoxHandwriting が測って渡す) */
const WRITE_CELL = 'var(--fit-cell, min(3rem, 7svh))'
const WRITE_FONT = 'calc(var(--cell) * 0.625)'

/**
 * 1行の式(筆算にしない計算)を手書きで答えるときの、答えのマス「= □□」。
 *
 * 式そのものは上に別に出してある(ヒントの下)。ここは答えを書くマスだけで、
 * 筆算と同じく1マスに1字ずつ書いてもらい、字を読み取って自動で判定する。
 * 大きな1枚のキャンバスに書く形だと、どこに何けた書いたかが分からず読み取れない。
 */
export function AnswerRowForm({ cells }: { cells: ReactNode }) {
  return (
    <span
      data-fit-width
      // 幅は中身のまま(w-max)。画面の幅で縮められると、マスの大きさを決めるための幅が測れない
      className="inline-flex w-max items-center gap-[0.3em] font-bold"
      style={{ '--cell': WRITE_CELL, fontSize: WRITE_FONT } as CSSProperties}
    >
      <span aria-hidden="true">=</span>
      <span className="flex gap-0.5">{cells}</span>
    </span>
  )
}
