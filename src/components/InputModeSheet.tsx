import { useEffect, useRef } from 'react'
import type { Genre, InputMode } from '@/types'

interface InputModeSheetProps {
  genre: Genre
  onStart: (mode: InputMode) => void
  onClose: () => void
}

const MODE_LABEL: Record<InputMode, { label: string; note: string }> = {
  typing: { label: 'タイピング', note: 'キーボードで入力する' },
  handwriting: { label: '手書き', note: '指でなぞって書く' },
  assemble: { label: 'パーツを組む', note: '思い出してから部品をえらんで組み立てる' },
}

/**
 * ジャンルを選んだあと、出題を始める前に入力方法を選ぶシート。
 *
 * 出題中に切り替えられるようにしていたときは、ヒントのタイマーが動きだしてから
 * 選ぶことになっていた。開始のきっかけをここに移し、
 * 出題画面はスタート後の状態だけを持つようにする。
 */
export function InputModeSheet({ genre, onStart, onClose }: InputModeSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // 開いた直後にシート内へフォーカスを移し、Esc で閉じられるようにする
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
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${genre.label}のはじめかた`}
        tabIndex={-1}
        className="animate-bloom-in relative w-full max-w-md rounded-3xl bg-base-50 px-5 pt-6 pb-6 outline-none"
      >
        <p className="text-center text-sm text-ink-400">{genre.label}</p>
        <h2 className="mt-1 text-center text-xl font-bold">
          {genre.inputModes.length > 1 ? 'こたえかたをえらぶ' : 'はじめる'}
        </h2>

        <div className="mt-6 flex flex-col gap-3">
          {genre.inputModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onStart(mode)}
              className={`flex min-h-16 flex-col justify-center rounded-2xl px-5 text-left ${
                genre.defaultInputMode === mode
                  ? 'bg-bloom-700 text-white'
                  : 'border-2 border-bloom-200 text-ink-900'
              }`}
            >
              <span className="text-lg font-bold">{MODE_LABEL[mode].label}</span>
              <span
                className={`text-sm ${
                  genre.defaultInputMode === mode ? 'text-bloom-100' : 'text-ink-600'
                }`}
              >
                {MODE_LABEL[mode].note}
              </span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onClose} className="mt-6 w-full text-sm text-ink-400 underline">
          もどる
        </button>
      </div>
    </div>
  )
}
