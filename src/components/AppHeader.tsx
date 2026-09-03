import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

/**
 * 全画面共通のヘッダー。左に横組みロゴを置く。
 * 出題中(exitTo あり)だけは並びを入れ替え、左を「やめる」、右をロゴにする。
 */
export function AppHeader({ exitTo }: AppHeaderProps) {
  const navigate = useNavigate()
  const [isConfirming, setIsConfirming] = useState(false)

  if (!exitTo) {
    return (
      <header className="flex items-center justify-between border-b border-bloom-100 px-5 py-3">
        <Link to="/" aria-label="トップへ" className="inline-flex">
          <BloomLogo variant="horizontal" className="h-9 w-auto" />
        </Link>
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
        ← やめる
      </button>

      {/* 出題中はロゴから飛ばさない。リンクを外し、ただの絵として置く */}
      <BloomLogo variant="horizontal" className="h-9 w-auto" />

      {isConfirming && (
        <ExitConfirmDialog
          onCancel={() => setIsConfirming(false)}
          onExit={() => navigate(exitTo)}
        />
      )}
    </header>
  )
}

/** 出題をやめて画面を離れる前の確認。押し間違いで問題が飛ぶのを止める */
function ExitConfirmDialog({
  onCancel,
  onExit,
}: {
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
        aria-label="とちゅうでやめる"
        tabIndex={-1}
        className="animate-bloom-in relative w-full max-w-md rounded-3xl bg-base-50 px-5 pt-6 pb-6 text-center outline-none"
      >
        <h2 className="text-xl font-bold">とちゅうで やめる?</h2>
        <p className="mt-2 text-sm text-ink-600">いまの問題は とばされます。</p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-14 rounded-full bg-bloom-700 text-lg font-bold text-white"
          >
            つづける
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-14 rounded-full border-2 border-bloom-200 text-lg font-bold text-ink-900"
          >
            やめる
          </button>
        </div>
      </div>
    </div>
  )
}
