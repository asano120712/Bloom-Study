import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import { NumberPad } from './NumberPad'

interface NumberInputProps {
  onSubmit: (value: string) => void
  /**
   * 打った数の見せ方を差し替える。
   *
   * 筆算のときは、答えを式の線の下に出したい(紙の筆算と同じ場所)。
   * 打った数はこの部品が持っているので、見せ方だけを外から渡してもらう。
   */
  display?: (typed: string) => ReactNode
  /** 決定キーの文字。筆算の途中の段では「つぎの段へ」になる */
  submitLabel?: string
  /** 打てる桁数。筆算では、そのマスに入りうるぶんだけ(小数点は数えない) */
  maxLength?: number
  /** 小数点を打てるようにする(小数の答えだけ) */
  allowDecimal?: boolean
  disabled?: boolean
}

/** 答えの桁数の上限。小学校の範囲ではこれで足りる */
const MAX_LENGTH = 6

/**
 * 数で答える入力。打った数をそのまま上に出し、数字キーボードで入れる。
 *
 * 物理キーボードでも打てるようにキーイベントを拾う(タイピング入力と同じ作法)。
 * ただしキーボードを畳む仕組みは持たない。数字キーは10個しかなく、
 * 畳んでも空いた場所に出すものが無いため。
 */
export function NumberInput({
  onSubmit,
  display,
  submitLabel,
  maxLength = MAX_LENGTH,
  allowDecimal = false,
  disabled = false,
}: NumberInputProps) {
  const copy = useCopy()
  const [value, setValue] = useState('')

  const append = useCallback((digit: string) => {
    setValue((current) => {
      if (digit === '.') {
        // 小数点は1つだけ。最初に打ったら「0.」にする(「.5」は 0.5 のこと)
        if (!allowDecimal || current.includes('.')) return current
        return current ? `${current}.` : '0.'
      }
      // 小数点は桁に数えない(マスを使わず、数字の右下に添えるため)
      if (current.replace('.', '').length >= maxLength) return current
      // 先頭の 0 は積まない(「007」のような入力にしない)
      if (current === '0') return digit
      return current + digit
    })
  }, [maxLength, allowDecimal])

  const backspace = useCallback(() => {
    setValue((current) => current.slice(0, -1))
  }, [])

  /*
    打った数をそのまま読んで渡す。
    setValue の更新関数の中で onSubmit を呼ぶと、React が更新関数を2回走らせたとき
    (そういう作りになっている)に1回の決定で2回進んでしまう。
    筆算では、1回のタップで段を2つ進めて、打った数が答えとして判定されていた。
  */
  const submit = useCallback(() => {
    if (value) onSubmit(value)
  }, [value, onSubmit])

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
      {/*
        筆算が縦に長くなっても(わり算は引く段で6段になる)、数字キーボードは
        画面から押し出さない。入りきらないぶんはここだけが流れる。
      */}
      <div
        aria-live="polite"
        aria-label={copy.number.inputLabel}
        className="flex min-h-0 shrink flex-col justify-end overflow-y-auto"
      >
        {display ? (
          display(value)
        ) : (
          <div className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-bloom-200 bg-white px-4">
            {value ? (
              <span className="text-3xl font-bold tracking-[0.1em] text-ink-900">{value}</span>
            ) : (
              <span className="text-base text-ink-400">{copy.number.placeholder}</span>
            )}
          </div>
        )}
      </div>

      <NumberPad
        onKey={append}
        onBackspace={backspace}
        onSubmit={submit}
        canSubmit={value.length > 0}
        submitLabel={submitLabel ?? copy.number.submit}
        allowDecimal={allowDecimal}
        disabled={disabled}
      />
    </div>
  )
}
