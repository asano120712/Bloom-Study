import { useEffect, useRef, useState } from 'react'
import { DIFFICULTIES, type Difficulty, type Genre, type InputMode } from '@/types'

interface InputModeSheetProps {
  genre: Genre
  onStart: (mode: InputMode, difficulty: Difficulty) => void
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
  /** 難易度は最初「ふつう」を選んでおき、こたえかたを押した時点で確定する */
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

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
        <h2 className="mt-1 text-center text-xl font-bold">はじめる</h2>

        <div className="mt-6">
          <p className="text-sm font-bold text-ink-600">なんいど</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((option) => {
              const isSelected = difficulty === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setDifficulty(option.id)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 text-center ${
                    isSelected
                      ? 'border-2 border-bloom-700 bg-bloom-100 text-bloom-700'
                      : 'border-2 border-bloom-200 text-ink-600'
                  }`}
                >
                  <span className="text-base font-bold">{option.label}</span>
                  <span className="mt-0.5 text-xs text-ink-400">{option.note}</span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="mt-6 text-sm font-bold text-ink-600">
          {genre.inputModes.length > 1 ? 'こたえかた' : 'はじめかた'}
        </p>
        <div className="mt-2 flex flex-col gap-3">
          {genre.inputModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onStart(mode, difficulty)}
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
