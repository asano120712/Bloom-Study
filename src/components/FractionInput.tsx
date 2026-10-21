import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { fractionText } from '@/features/math'
import { useCopy } from '@/hooks/useAudienceMode'
import { NumberPad } from './NumberPad'

/**
 * 分数で答えるときのマス。答えの 整数・分子・分母 と、途中式の分子・分母(work1 / work2)。
 * 途中式は分数が1つか2つ(通分した形や、ひっくり返した形)。
 */
export type FractionPart =
  | 'work1Numerator'
  | 'work1Denominator'
  | 'work2Numerator'
  | 'work2Denominator'
  | 'whole'
  | 'numerator'
  | 'denominator'

export type FractionEntry = Partial<Record<FractionPart, string>>

interface FractionInputProps {
  /** この問題で出すマス。並びがそのまま打つ順(Tab で移る順) */
  parts: FractionPart[]
  /** 答えのマスから作った「7/4」「1 3/4」「2」を渡す。途中式は判定に使わない */
  onSubmit: (value: string) => void
  /** 打ったものの見せ方(式と並べるので、外から渡してもらう) */
  display: (
    entry: FractionEntry,
    focus: FractionPart,
    select: (part: FractionPart) => void,
  ) => ReactNode
  /** 打った数が変わったとき(約分の注意を消すため) */
  onChange?: () => void
  disabled?: boolean
}

/** 1つのマスに打てる桁数。小学校の分数は2けたまでで足りる(途中式で3けたになることがある) */
const MAX_DIGITS = 3

/** 分子のマスから、組になる分母のマスへ(「/」を打ったとき) */
const DENOMINATOR_OF: Partial<Record<FractionPart, FractionPart>> = {
  work1Numerator: 'work1Denominator',
  work2Numerator: 'work2Denominator',
  numerator: 'denominator',
  whole: 'denominator',
}

function answerText(entry: FractionEntry): string {
  return fractionText({
    whole: entry.whole ?? '',
    numerator: entry.numerator ?? '',
    denominator: entry.denominator ?? '',
  })
}

/** 答えとして出せる形か(答えの分子と分母がそろっているか、整数だけか)。途中式は問わない */
function isComplete(entry: FractionEntry): boolean {
  if (entry.numerator || entry.denominator) return Boolean(entry.numerator && entry.denominator)
  return Boolean(entry.whole)
}

/**
 * 分数で答える入力。マスをタップで選び、数字キーボードで打つ。
 *
 * 最初は途中式の1つめの分子に打つ(紙でも、式の次に書くところ)。
 * 途中式は打たなくても答えられる。通分の分母は 12 でも 24 でも正しく、
 * 決まった形と比べて確かめることができないため、判定には使わない。
 * 物理キーボードでは「/」で分母へ、Tab で次のマスへ移れる。
 */
export function FractionInput({ parts, onSubmit, display, onChange, disabled = false }: FractionInputProps) {
  const copy = useCopy()
  const [entry, setEntry] = useState<FractionEntry>({})
  const [focus, setFocus] = useState<FractionPart>(parts[0])

  const update = useCallback(
    (next: (typed: string) => string) => {
      setEntry((current) => ({ ...current, [focus]: next(current[focus] ?? '') }))
      onChange?.()
    },
    [focus, onChange],
  )

  const append = useCallback(
    (digit: string) =>
      update((typed) => {
        if (typed.length >= MAX_DIGITS) return typed
        // 先頭の 0 は積まない
        return typed === '0' ? digit : typed + digit
      }),
    [update],
  )

  const backspace = useCallback(() => update((typed) => typed.slice(0, -1)), [update])

  const submit = useCallback(() => {
    if (isComplete(entry)) onSubmit(answerText(entry))
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
      } else if (event.key === '/') {
        event.preventDefault()
        setFocus((current) => DENOMINATOR_OF[current] ?? current)
      } else if (event.key === 'Tab') {
        event.preventDefault()
        setFocus((current) => {
          const step = event.shiftKey ? parts.length - 1 : 1
          return parts[(parts.indexOf(current) + step) % parts.length]
        })
      } else if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        append(event.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, parts, append, backspace, submit])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        aria-live="polite"
        aria-label={copy.number.inputLabel}
        className="flex min-h-0 shrink flex-col justify-end overflow-y-auto"
      >
        {display(entry, focus, setFocus)}
      </div>

      <NumberPad
        onKey={append}
        onBackspace={backspace}
        onSubmit={submit}
        canSubmit={isComplete(entry)}
        submitLabel={copy.number.submit}
        disabled={disabled}
      />
    </div>
  )
}
