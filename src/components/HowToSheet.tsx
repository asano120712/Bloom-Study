import { useEffect, useRef, useState } from 'react'
import { HowToDemo } from '@/components/HowToDemo'
import { demosFor } from '@/data/howTo'
import { useCopy } from '@/hooks/useAudienceMode'
import type { ActivityId } from '@/data/activities'

/**
 * あそびかた。一覧のカードの「？」から開く。
 *
 * **あそび1つぶんを、手順ごとに1画面ずつ**出す。
 * 手順を全部並べると、読む前に長さで降りてしまう。1つずつなら、
 * その手順のデモと文だけを見ればよく、次に進むかどうかも自分で決められる。
 *
 * 文の横ではなく上にデモを置くのは、狭い画面で絵が潰れないようにするため。
 */
export function HowToSheet({ activity, onClose }: { activity: ActivityId; onClose: () => void }) {
  const copy = useCopy()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const words = copy.activities[activity]
  const steps = copy.howTo.steps[activity]
  const demos = demosFor(activity, steps.length)
  const isLast = index === steps.length - 1

  // 開いた直後にシート内へフォーカスを移し、Esc で1つ前(先頭なら閉じる)へ戻る
  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIndex((current) => {
        if (current === 0) onClose()
        return Math.max(0, current - 1)
      })
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

        {/* key を変えて作り直す。前の手順の動きが途中から続いて見えないように */}
        <div className="mt-5">
          <HowToDemo key={`${activity}-${index}`} id={demos[index]} activity={activity} />
        </div>

        {/*
          文の高さは手順で変わるが、枠は変えない。変えるとボタンの位置が動き、
          続けて「つぎへ」を押すときに押し間違える。
        */}
        <p
          aria-live="polite"
          className="mt-4 flex min-h-20 items-start gap-3 text-base leading-relaxed"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bloom-100 text-sm font-bold text-bloom-700">
            {index + 1}
          </span>
          <span>{steps[index]}</span>
        </p>

        {/* いま何手目か。数より、残りの量が見えることのほうが大事なので点で出す */}
        <div aria-hidden="true" className="mt-2 flex justify-center gap-2">
          {steps.map((step, dot) => (
            <span
              key={step}
              className={`size-2 rounded-full ${dot === index ? 'bg-bloom-700' : 'bg-bloom-200'}`}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className="min-h-14 flex-1 rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600"
            >
              {copy.howTo.back}
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setIndex(index + 1))}
            className="min-h-14 flex-2 rounded-full bg-bloom-700 text-lg font-bold text-white"
          >
            {isLast ? copy.howTo.close : copy.howTo.next}
          </button>
        </div>
      </div>
    </div>
  )
}
