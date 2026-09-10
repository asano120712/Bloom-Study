import { useEffect, useRef, useState } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import { DIFFICULTY_ORDER, type Difficulty, type Genre, type InputMode } from '@/types'

interface InputModeSheetProps {
  genre: Genre
  onStart: (mode: InputMode, difficulty: Difficulty) => void
  onClose: () => void
}

/**
 * ジャンルを選んだあと、出題を始める前の設定シート。
 *
 * こたえかた → なんいど の2ステップで選ぶ。
 * こたえかたを先に決めてから難易度を選ぶことで、選択の流れを1本にする。
 */
export function InputModeSheet({ genre, onStart, onClose }: InputModeSheetProps) {
  const copy = useCopy()
  const genreWords = copy.activities[genre.id]
  const dialogRef = useRef<HTMLDivElement>(null)
  /** 'mode' = こたえかた選択、'difficulty' = なんいど選択 */
  const [step, setStep] = useState<'mode' | 'difficulty'>('mode')
  /** こたえかたステップで選んだ入力方法。なんいど確定時に一緒に渡す */
  const [selectedMode, setSelectedMode] = useState<InputMode | null>(null)

  const backToMode = () => {
    setStep('mode')
    setSelectedMode(null)
  }

  // 開いた直後にシート内へフォーカスを移し、Esc で1つ前(なんいど→こたえかた、
  // こたえかた→閉じる)へ戻れるようにする
  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (step === 'difficulty') backToMode()
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, onClose])

  const chooseMode = (mode: InputMode) => {
    setSelectedMode(mode)
    setStep('difficulty')
  }

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
        aria-label={`${genreWords.label}のはじめかた`}
        tabIndex={-1}
        className="animate-bloom-in relative w-full max-w-md rounded-3xl bg-base-50 px-5 pt-6 pb-6 outline-none"
      >
        <p className="text-center text-sm text-ink-400">{genreWords.label}</p>

        {step === 'mode' ? (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">
              {genre.inputModes.length > 1 ? copy.sheet.chooseMode : copy.sheet.start}
            </h2>

            <div className="mt-6 flex flex-col gap-3">
              {genre.inputModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => chooseMode(mode)}
                  className={`flex min-h-16 flex-col justify-center rounded-2xl px-5 text-left ${
                    genre.defaultInputMode === mode
                      ? 'bg-bloom-700 text-white'
                      : 'border-2 border-bloom-200 text-ink-900'
                  }`}
                >
                  <span className="text-lg font-bold">{copy.inputModes[mode].label}</span>
                  <span
                    className={`text-sm ${
                      genre.defaultInputMode === mode ? 'text-bloom-100' : 'text-ink-600'
                    }`}
                  >
                    {copy.inputModes[mode].note}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full text-sm text-ink-400 underline"
            >
              {copy.sheet.close}
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">{copy.sheet.chooseDifficulty}</h2>
            {selectedMode && (
              <p className="mt-1 text-center text-sm text-ink-400">
                {copy.sheet.modeIs(copy.inputModes[selectedMode].label)}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {DIFFICULTY_ORDER.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => selectedMode && onStart(selectedMode, level)}
                  className={`flex min-h-16 flex-col justify-center rounded-2xl px-5 text-left ${
                    level === 'normal'
                      ? 'bg-bloom-700 text-white'
                      : 'border-2 border-bloom-200 text-ink-900'
                  }`}
                >
                  <span className="text-lg font-bold">{copy.difficulties[level].label}</span>
                  <span
                    className={`text-sm ${level === 'normal' ? 'text-bloom-100' : 'text-ink-600'}`}
                  >
                    {copy.difficulties[level].note}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={backToMode}
              className="mt-6 w-full text-sm text-ink-400 underline"
            >
              {copy.sheet.backToMode}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
