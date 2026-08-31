import { useCallback, useEffect, useState } from 'react'
import { useHasFinePointer } from '@/hooks/useHasFinePointer'
import { OnScreenKeyboard } from './OnScreenKeyboard'

interface TypingInputProps {
  onSubmit: (value: string) => void
  disabled?: boolean
}

/** 答えは1語の英単語に限っているので、受け付けるのは a〜z だけ */
const MAX_LENGTH = 24

/**
 * タイピング入力。判定はレベル1+レベル2(features/judge)が担う。
 *
 * フォーカス可能な input を置かず、画面内キーボードだけで入力する。
 * OS のキーボードを出すと、iOS の予測変換バーに答えが出てしまうため
 * (「lib」まで打つと library が候補に並ぶ)。この挙動は
 * autocomplete / autocorrect / spellcheck では抑止できない。
 *
 * 物理キーボードでも打てるようにキーイベントを拾う。
 * マウス操作の端末(=物理キーボードがある)では画面キーボードを畳んでおき、
 * 必要なら手動で開けるようにしている。
 */
export function TypingInput({ onSubmit, disabled = false }: TypingInputProps) {
  const [value, setValue] = useState('')
  const hasFinePointer = useHasFinePointer()
  /** マウス操作の端末でも、手動で画面キーボードを開けるようにする */
  const [forceKeyboard, setForceKeyboard] = useState(false)
  const showKeyboard = !hasFinePointer || forceKeyboard

  const append = useCallback((letter: string) => {
    setValue((current) => (current.length >= MAX_LENGTH ? current : current + letter))
  }, [])

  const backspace = useCallback(() => {
    setValue((current) => current.slice(0, -1))
  }, [])

  const submit = useCallback(() => {
    setValue((current) => {
      if (current) onSubmit(current)
      return current
    })
  }, [onSubmit])

  useEffect(() => {
    if (disabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Backspace') {
        event.preventDefault()
        backspace()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        submit()
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault()
        append(event.key.toLowerCase())
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, append, backspace, submit])

  return (
    <div className={`flex flex-col gap-3 ${showKeyboard ? 'min-h-0 flex-1' : 'shrink-0'}`}>
      <div
        aria-live="polite"
        aria-label="入力中のこたえ"
        className="flex min-h-14 w-full shrink-0 items-center justify-center rounded-2xl border-2 border-bloom-200 bg-white px-4"
      >
        {value ? (
          <span className="text-2xl font-bold tracking-[0.15em] text-ink-900">{value}</span>
        ) : (
          <span className="text-base text-ink-400">
            {showKeyboard ? 'こたえをタップして入力' : 'キーボードで入力'}
          </span>
        )}
      </div>

      {showKeyboard ? (
        <OnScreenKeyboard
          onKey={append}
          onBackspace={backspace}
          onSubmit={submit}
          canSubmit={value.length > 0}
          disabled={disabled}
        />
      ) : (
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={disabled || !value}
            onClick={submit}
            className="min-h-14 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
          >
            こたえあわせ
          </button>
          <button
            type="button"
            onClick={() => setForceKeyboard(true)}
            className="text-sm text-ink-400 underline"
          >
            画面のキーボードを使う
          </button>
        </div>
      )}
    </div>
  )
}
