import { useEffect, useRef, useState } from 'react'
import { answerChoicesOf, difficultiesOf, type AnswerChoice } from '@/data/genres'
import { useCopy } from '@/hooks/useAudienceMode'
import type { Difficulty, Genre } from '@/types'

interface InputModeSheetProps {
  genre: Genre
  /** なんいどとこたえかたが決まったとき。行き先の出し分けは呼び出し側が決める */
  onStart: (difficulty: Difficulty, choice: AnswerChoice) => void
  onClose: () => void
}

/**
 * ジャンルを選んだあと、出題を始める前の設定シート。
 *
 * なんいど → こたえかた の2ステップで選ぶ。
 * **なんいどが先**なのは、選べるこたえかたが なんいど で変わるため。
 * 小1・小2の漢字は熟語の穴うめが成立しないので、この学年だけ
 * こたえかたが「なぞりがき」「くみたて」に差し替わる。
 */
export function InputModeSheet({ genre, onStart, onClose }: InputModeSheetProps) {
  const copy = useCopy()
  const genreWords = copy.activities[genre.id]
  const dialogRef = useRef<HTMLDivElement>(null)
  /** 'difficulty' = なんいど選択、'answer' = こたえかた選択 */
  const [step, setStep] = useState<'difficulty' | 'answer'>('difficulty')
  /** なんいどステップで選んだ難易度。こたえかた確定時に一緒に渡す */
  const [selected, setSelected] = useState<Difficulty | null>(null)

  const backToDifficulty = () => {
    setStep('difficulty')
    setSelected(null)
  }

  // 開いた直後にシート内へフォーカスを移し、Esc で1つ前(こたえかた→なんいど、
  // なんいど→閉じる)へ戻れるようにする
  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (step === 'answer') backToDifficulty()
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, onClose])

  const chooseDifficulty = (difficulty: Difficulty) => {
    setSelected(difficulty)
    setStep('answer')
  }

  const choices = selected ? answerChoicesOf(genre.id, selected) : []

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

        {step === 'difficulty' ? (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">{copy.sheet.chooseDifficulty}</h2>

            {/* 6段階まで並ぶので、はみ出す端末では中でスクロールさせる */}
            <div className="mt-6 flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain">
              {difficultiesOf(genre.id).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => chooseDifficulty(level)}
                  className="flex min-h-16 shrink-0 flex-col justify-center rounded-2xl border-2 border-bloom-200 px-5 text-left text-ink-900"
                >
                  <span className="text-lg font-bold">{copy.difficulties[level].label}</span>
                  <span className="text-sm text-ink-600">{copy.difficulties[level].note}</span>
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
            <h2 className="mt-1 text-center text-xl font-bold">
              {choices.length > 1 ? copy.sheet.chooseMode : copy.sheet.start}
            </h2>
            {selected && (
              <p className="mt-1 text-center text-sm text-ink-400">
                {copy.sheet.levelIs(copy.difficulties[selected].label)}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => selected && onStart(selected, choice)}
                  className={`flex min-h-16 flex-col justify-center rounded-2xl px-5 text-left ${
                    // 先頭を勧める(並び順がそのまま勧める順)
                    index === 0 ? 'bg-bloom-700 text-white' : 'border-2 border-bloom-200 text-ink-900'
                  }`}
                >
                  <span className="text-lg font-bold">{copy.answerModes[choice.id].label}</span>
                  <span className={`text-sm ${index === 0 ? 'text-bloom-100' : 'text-ink-600'}`}>
                    {copy.answerModes[choice.id].note}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={backToDifficulty}
              className="mt-6 w-full text-sm text-ink-400 underline"
            >
              {copy.sheet.backToDifficulty}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
