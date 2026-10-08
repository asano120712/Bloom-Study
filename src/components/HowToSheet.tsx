import { useEffect, useRef } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import type { ActivityId } from '@/data/activities'

/**
 * あそびかた。一覧のカードの「？」から開く。
 *
 * **あそび1つぶんだけ**を出す。なぞりがきは指の動かし方、計算は筆算の打ち方と、
 * 中身がまったく違うので、1つにまとめると自分に関係のある段落を探すことになる。
 *
 * 読むのは始める前なので、やることだけを短く並べる。
 * 細かい決まり(判定のしかたなど)は、実際にその場面で出る言葉で伝える。
 */
export function HowToSheet({ activity, onClose }: { activity: ActivityId; onClose: () => void }) {
  const copy = useCopy()
  const dialogRef = useRef<HTMLDivElement>(null)
  const words = copy.activities[activity]

  // 開いた直後にシート内へフォーカスを移し、Esc で閉じられるようにする(はじめかたと同じ作法)
  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 py-6">
      <button
        type="button"
        aria-label={copy.howTo.close}
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.howTo.open(words.label)}
        tabIndex={-1}
        className="animate-bloom-in relative w-full max-w-md rounded-3xl bg-base-50 px-5 pt-6 pb-6 outline-none"
      >
        <p className="text-center text-sm text-ink-400">{words.label}</p>
        <h2 className="mt-1 text-center text-xl font-bold">{copy.howTo.title}</h2>

        {/* 長いあそびでも画面に収まるよう、中でだけ流す */}
        <ol className="mt-6 flex max-h-[60vh] list-none flex-col gap-4 overflow-y-auto overscroll-contain">
          {copy.howTo.steps[activity].map((line, index) => (
            <li key={line} className="flex gap-3">
              {/* 順番のある手順なので番号を振る。字を読めない子には、保護者が読む前提 */}
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bloom-100 text-sm font-bold text-bloom-700">
                {index + 1}
              </span>
              <span className="text-base leading-relaxed text-ink-900">{line}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-8 min-h-14 w-full rounded-full bg-bloom-700 text-lg font-bold text-white"
        >
          {copy.howTo.close}
        </button>
      </div>
    </div>
  )
}
