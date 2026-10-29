import { Link } from 'react-router-dom'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { BloomMark } from './BloomMark'

/**
 * あそび(なぞりがき・おなじものさがし)の、進み具合と終わりの画面。
 *
 * こどもは字や数を読めない年齢も来るので、できた数を花で見せ、終わりは花が喜ぶ。
 * おとな(小1・2の漢字を選んだとき)は、出題と同じく「何問目」を字で出し、
 * 終わりも結果画面と同じく落ち着いた見せ方にする(喜ぶ顔はこども向けだけ)。
 */
export function PlayProgress({ total, done }: { total: number; done: number }) {
  const copy = useCopy()
  const isKids = useAudienceMode() === 'kids'

  if (!isKids) {
    return (
      <p aria-live="polite" className="shrink-0 pt-1 text-center text-sm font-bold text-ink-600">
        {copy.play.progress(Math.min(done + 1, total), total)}
      </p>
    )
  }

  return (
    // できた数を花で出す。数字より、増えていくのが見えるほうが分かりやすい
    <div className="flex shrink-0 items-center justify-center gap-2 pt-1">
      {Array.from({ length: total }, (_, position) => (
        <span
          key={position}
          className={`transition-opacity duration-500 ${position < done ? '' : 'opacity-20 grayscale'}`}
        >
          <BloomMark size={20} motion="none" />
        </span>
      ))}
    </div>
  )
}

export function PlayFinished({ onRestart }: { onRestart: () => void }) {
  const copy = useCopy()
  const isKids = useAudienceMode() === 'kids'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <BloomMark size={isKids ? 120 : 80} face={isKids ? 'joy' : undefined} />
      <p className="text-2xl font-bold text-bloom-700">{copy.play.allDone}</p>

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-16 w-full items-center justify-center rounded-full bg-bloom-700 text-xl font-bold text-white"
        >
          {copy.play.again}
        </button>
        <Link
          to="/genres"
          className="flex min-h-14 items-center justify-center rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600"
        >
          {copy.play.other}
        </Link>
      </div>
    </div>
  )
}
