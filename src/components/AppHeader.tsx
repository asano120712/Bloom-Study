import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Copy } from '@/data/copy'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { writeAudienceMode } from '@/services/audienceMode'
import { TOP_PATH, type AudienceMode } from '@/types'
import { BloomLogo } from './BloomLogo'

interface AppHeaderProps {
  /**
   * 出題中など、うっかり離脱させたくない画面で渡す戻り先。
   *
   * 渡すとロゴのリンクを外し(押しても飛ばない)、代わりに左上へ確認つきの
   * 「やめる」を出す。ヒントが出そろう前に画面ごと消えるのを防ぐため。
   */
  exitTo?: string
}

/** 切り替えに出す名前 */
const AUDIENCE_LABEL: Record<AudienceMode, string> = {
  adult: '一般',
  kids: 'こども',
}

/**
 * 全画面共通のヘッダー。左に横組みロゴ、右におとな/こどもの切り替えを置く。
 * 出題中(exitTo あり)だけは並びを入れ替え、左を「やめる」、右をロゴにする。
 */
export function AppHeader({ exitTo }: AppHeaderProps) {
  const navigate = useNavigate()
  const mode = useAudienceMode()
  const copy = useCopy()
  const [isConfirming, setIsConfirming] = useState(false)

  if (!exitTo) {
    return (
      <header className="flex items-center justify-between gap-3 border-b border-bloom-100 px-5 py-3">
        {/*
          ロゴは横長(300:62)で、切り替えと並べると 320px 幅の端末で収まらない。
          min-w-0 で縮めるのを許し、object-contain で縦横比を保ったまま小さくする
          (h-9 と w-auto だけだと、縮んだ幅に合わせて字が潰れる)。
        */}
        <Link
          to={TOP_PATH[mode]}
          aria-label="トップへ"
          className="inline-flex min-w-0"
        >
          <BloomLogo variant="horizontal" className="h-9 w-auto max-w-full object-contain" />
        </Link>
        <AudienceSwitch current={mode} />
      </header>
    )
  }

  return (
    <header className="flex items-center justify-between border-b border-bloom-100 px-5 py-3">
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="-ml-2 inline-flex min-h-11 items-center rounded-full px-3 text-base font-bold text-ink-600"
      >
        {copy.exit.label}
      </button>

      {/*
        出題中はロゴから飛ばさない。リンクを外し、ただの絵として置く。
        おとな/こどもの切り替えもここでは出さない(切り替えるとトップへ移るため、
        離脱を止めたい画面に抜け道を作ってしまう)。
      */}
      <BloomLogo variant="horizontal" className="h-9 w-auto" />

      {isConfirming && (
        <ExitConfirmDialog
          words={copy.exit}
          onCancel={() => setIsConfirming(false)}
          onExit={() => navigate(exitTo)}
        />
      )}
    </header>
  )
}

/**
 * おとな / こども の切り替え。押すとそのモードのトップへ移る。
 *
 * 途中の画面から押しても行き先はトップにする。モードで出すジャンルが変わるので、
 * ジャンル選択や結果の途中に居たまま中身だけ入れ替わると、どこに居るのか分からなくなる。
 */
function AudienceSwitch({ current }: { current: AudienceMode }) {
  return (
    <nav
      aria-label="つかう人をえらぶ"
      className="flex shrink-0 gap-0.5 rounded-full bg-bloom-50 p-0.5"
    >
      {(['adult', 'kids'] as const).map((mode) => (
        <Link
          key={mode}
          to={TOP_PATH[mode]}
          // 行き先のトップも同じ判断をするが、先に書いておくと往復しても迷わない
          onClick={() => writeAudienceMode(mode)}
          aria-current={mode === current ? 'page' : undefined}
          className={`flex min-h-9 items-center rounded-full px-2.5 text-xs font-bold ${
            mode === current ? 'bg-bloom-700 text-white' : 'text-ink-600'
          }`}
        >
          {AUDIENCE_LABEL[mode]}
        </Link>
      ))}
    </nav>
  )
}

/** 出題をやめて画面を離れる前の確認。押し間違いで問題が飛ぶのを止める */
function ExitConfirmDialog({
  words,
  onCancel,
  onExit,
}: {
  words: Copy['exit']
  onCancel: () => void
  onExit: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // 開いた直後にダイアログへフォーカスを移し、Esc で閉じられるようにする
  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 py-6">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onCancel}
        className="absolute inset-0 bg-ink-900/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={words.title}
        tabIndex={-1}
        className="animate-bloom-in relative w-full max-w-md rounded-3xl bg-base-50 px-5 pt-6 pb-6 text-center outline-none"
      >
        <h2 className="text-xl font-bold">{words.title}</h2>
        <p className="mt-2 text-sm text-ink-600">{words.note}</p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-14 rounded-full bg-bloom-700 text-lg font-bold text-white"
          >
            {words.stay}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-14 rounded-full border-2 border-bloom-200 text-lg font-bold text-ink-900"
          >
            {words.leave}
          </button>
        </div>
      </div>
    </div>
  )
}
