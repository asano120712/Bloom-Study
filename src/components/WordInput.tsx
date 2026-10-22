import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import { useFitCell } from '@/hooks/useFitCell'
import { NumberPad } from './NumberPad'

/** 文章題で打つマス。式の左と右、答え */
export type WordPart = 'left' | 'right' | 'answer'

export type WordEntry = Record<WordPart, string>

interface WordInputProps {
  /** 答えのマスに打った数を渡す。式は判定に使わない */
  onSubmit: (value: string) => void
  /** 打ったものの見せ方(式と答えのマスは外で並べる) */
  display: (entry: WordEntry, focus: WordPart, select: (part: WordPart) => void) => ReactNode
  disabled?: boolean
}

/** マスの大きさの下限と上限(px)。数字キーボードの筆算と同じ */
const FIT = { min: 20, max: 48 }
/** 1つのマスに打てる桁数(小数点は数えない)。文章題の数は 4けたまで */
const MAX_DIGITS = 4
const ORDER: WordPart[] = ['left', 'right', 'answer']

/**
 * 文章題を数字で答える入力。式の左・右と答えのマスをタップで選び、数字キーボードで打つ。
 *
 * 最初は式の左に打つ(紙でも、式を立ててから答えを書く)。式は打たなくても答えられる。
 * 割合は 0.75 のような小数を使うので、どのマスにも小数点を打てる。
 */
export function WordInput({ onSubmit, display, disabled = false }: WordInputProps) {
  const copy = useCopy()
  const [entry, setEntry] = useState<WordEntry>({ left: '', right: '', answer: '' })
  const [focus, setFocus] = useState<WordPart>('left')
  /** 式と答えのマスを置く場所。キーボードの残りに入る大きさまで、全体を広げる・縮める */
  const area = useRef<HTMLDivElement>(null)
  useFitCell(area, FIT)

  const append = useCallback(
    (key: string) =>
      setEntry((current) => {
        const typed = current[focus]
        if (key === '.') {
          // 小数点は1つだけ。最初に打ったら「0.」にする
          if (typed.includes('.')) return current
          return { ...current, [focus]: typed ? `${typed}.` : '0.' }
        }
        if (typed.replace('.', '').length >= MAX_DIGITS) return current
        return { ...current, [focus]: typed === '0' ? key : typed + key }
      }),
    [focus],
  )

  const backspace = useCallback(
    () => setEntry((current) => ({ ...current, [focus]: current[focus].slice(0, -1) })),
    [focus],
  )

  const submit = useCallback(() => {
    if (entry.answer) onSubmit(entry.answer)
  }, [entry, onSubmit])

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
      } else if (event.key === 'Tab') {
        event.preventDefault()
        setFocus((current) => ORDER[(ORDER.indexOf(current) + (event.shiftKey ? 2 : 1)) % 3])
      } else if (/^[0-9.]$/.test(event.key)) {
        event.preventDefault()
        append(event.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, append, backspace, submit])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={area}
        aria-live="polite"
        aria-label={copy.number.inputLabel}
        className="flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden"
      >
        {display(entry, focus, setFocus)}
      </div>

      <NumberPad
        onKey={append}
        onBackspace={backspace}
        onSubmit={submit}
        canSubmit={Boolean(entry.answer)}
        submitLabel={copy.number.submit}
        allowDecimal
        disabled={disabled}
      />
    </div>
  )
}
