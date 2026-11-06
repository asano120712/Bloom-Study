import { useState } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import { ICON_SOURCES } from '@/assets/logos'
import { HandwritingCanvas } from './HandwritingCanvas'

/**
 * 計算のメモ。紙の余白のように、自由に書いて計算できる。読み取りも判定もしない。
 *
 * **縦長の薄い紙を、出題の上に重ねる。** 下がうっすら透けるので、問題の数を見ながら書ける
 * (「下を透かす」を切ると真っ白になる。下の字が邪魔なとき)。
 *
 * 置き場所は画面の横幅で変える。
 * - 740px 未満(iPhone、iPhone Duo の縦持ち): 画面いっぱい近くに重ねる。右に置く幅が無い
 * - 740px 以上(iPhone Duo の横持ち、iPad、パソコン): 出題(真ん中に最大 28rem)の右に置き、
 *   左の端だけ少し重ねる。右の空きが狭いほど、左に多めに重なる(透けるので問題は読める)
 * 境目の 740px は、iPad mini の縦持ち(744px)をタブレットの側に、Duo の縦持ち(620〜720px ほど)を
 * iPhone の側に入れるため。向きではなく幅で決めるのは、縦に持った iPad もタブレットの形にしたいから。
 *
 * 閉じても消さない(open で見せ方だけ変える)。書いたものはその問題のあいだ残り、
 * 呼ぶ側が問題ごとに作り直す(key)ことで、次の問題では白紙に戻る。
 */
export function MemoPad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useCopy()
  /** 下を透かすか。既定は透かす(問題の数を見ながら書けるように) */
  const [seeThrough, setSeeThrough] = useState(true)

  return (
    <div
      role="dialog"
      aria-label={copy.quiz.memo}
      aria-hidden={!open}
      // 閉じているあいだは見せないだけ(書いたものを残すため、外さない)
      className={`fixed z-40 flex flex-col gap-2 rounded-3xl border-2 border-bloom-200 p-3 shadow-lg select-none ${
        seeThrough ? 'bg-base-50/80' : 'bg-base-50'
      } ${open ? '' : 'invisible pointer-events-none'} inset-x-3 top-3 bottom-3 min-[740px]:inset-x-auto min-[740px]:right-4 min-[740px]:w-[clamp(20rem,calc((100vw-28rem)/2+3rem),28rem)]`}
    >
      <div className="flex shrink-0 items-center gap-2">
        <h2 className="flex-1 text-base font-bold text-ink-900">{copy.quiz.memo}</h2>
        <label className="flex items-center gap-1 text-xs text-ink-600">
          <input
            type="checkbox"
            checked={seeThrough}
            onChange={(event) => setSeeThrough(event.target.checked)}
            className="size-4 accent-bloom-700"
          />
          {copy.quiz.memoSeeThrough}
        </label>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-10 items-center rounded-full border-2 border-bloom-200 px-4 text-sm font-bold text-ink-600"
        >
          {copy.quiz.memoClose}
        </button>
      </div>
      <HandwritingCanvas memo />
    </div>
  )
}

/**
 * メモのアイコン(public/images/memo.svg)。
 *
 * ファイルの形を型抜きに使い、色は文字色(currentColor)で塗る。<img> でそのまま置くと
 * ファイルの線の色(黒)のままになり、メモを開いているとき(ボタンが緑で塗られる)に白へ変えられない。
 * 形を変えたいときは、ファイルを差し替えるだけでよい。
 */
export function MemoIcon({ className }: { className?: string }) {
  const mask = `url(${ICON_SOURCES.memo}) center / contain no-repeat`
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-current ${className ?? ''}`}
      style={{ mask, WebkitMask: mask }}
    />
  )
}
