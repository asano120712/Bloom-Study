import { useState, type CSSProperties, type ReactNode } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import type { FractionSlot } from './FractionForm'

/** 文章題のマス1つぶん(式の左・右、答え)。分数のマスと同じ形 */
export type WordSlot = FractionSlot

/** 打つときのマス。置く場所に入る大きさ(--fit-cell)が測ってあれば、それに合わせる */
const CELL = 'var(--fit-cell, 1.15em)'
const TYPE_FONT = 'calc(var(--fit-cell) / 1.15)'
/** 手書きのときのマス。書く場所に入る最大の大きさ(BoxHandwriting が測って渡す) */
const WRITE_CELL = 'var(--fit-cell, min(3rem, 7svh))'
const WRITE_FONT = 'calc(var(--cell) * 0.625)'

/** 式の記号の選び方。タップするたびに × と ÷ を入れかえる(文章題は、かけるか わるかを選ぶ) */
const OPERATORS = ['×', '÷'] as const

/**
 * 文章題の「式」と「答え」のマス。文そのものは、上に別に出す(長い文は折り返すので、
 * マスの大きさを測るときに一緒に入れると、測り方がずれる)。
 *
 * 式は「□ ×/÷ □」。かけるのか わるのかを選ぶのが、割合・速さの練習の中心なので、
 * 記号はこちらで決めずにタップで選んでもらう。式は判定に使わない(分数の途中式と同じ)。
 * 答えには単位を添える(「時速 □ km」「□ %」)。単位まで書かせると、数が合っていても
 * 単位の書き方で外れてしまうので、こちらで出しておく。
 */
export function WordForm({
  left,
  right,
  expression,
  answer,
  prefix,
  unit,
  writing = false,
}: {
  /** 式の左と右の数のマス(数字キーボード)。記号はタップで選ぶ */
  left?: WordSlot
  right?: WordSlot
  /**
   * 式を自由に書く場所(手書き)。記号まで手で書くので、数のマスにも記号のボタンにも分けない。
   * 読み取らないので、紙と同じく思ったとおりに書ける
   */
  expression?: ReactNode
  answer: WordSlot
  /** 答えのマスの前に添える言葉(「時速」) */
  prefix?: string
  /** 答えのマスの後ろに添える単位(「km」「%」) */
  unit?: string
  writing?: boolean
}) {
  const copy = useCopy()
  const [operator, setOperator] = useState<(typeof OPERATORS)[number] | null>(null)

  return (
    <span
      data-fit-width
      // 幅は中身のまま(w-max)。画面の幅で縮められると、マスの大きさを決めるための幅が測れない
      className="inline-grid w-max grid-cols-[auto_auto] items-center gap-x-[0.4em] gap-y-2 font-bold tabular-nums"
      style={
        {
          '--cell': writing ? WRITE_CELL : CELL,
          fontSize: writing ? WRITE_FONT : TYPE_FONT,
        } as CSSProperties
      }
    >
      <span className="text-[0.6em] whitespace-nowrap text-ink-600">{copy.number.wordParts.expression}</span>
      <span className="flex items-center gap-[0.3em]">
        {expression ?? (
          <>
        {left && <Slot slot={left} />}
        <button
          type="button"
          onClick={() => setOperator((current) => (current === '×' ? '÷' : '×'))}
          aria-label={copy.number.wordParts.operator}
          className={`flex size-[var(--cell)] items-center justify-center rounded-full border-2 ${
            operator ? 'border-bloom-300 text-ink-900' : 'border-dashed border-bloom-200 text-[0.5em] text-ink-400'
          }`}
        >
          {operator ?? '×÷'}
        </button>
        {right && <Slot slot={right} />}
          </>
        )}
      </span>

      <span className="text-[0.6em] whitespace-nowrap text-ink-600">{copy.number.wordParts.answer}</span>
      <span className="flex items-center gap-[0.3em]">
        {prefix && <span className="text-[0.7em]">{prefix}</span>}
        <Slot slot={answer} />
        {unit && <span className="text-[0.7em]">{unit}</span>}
      </span>
    </span>
  )
}

function Slot({ slot }: { slot: WordSlot }) {
  if (slot.content !== undefined) {
    return (
      <span aria-label={slot.spokenLabel ?? slot.label} className="flex gap-0.5">
        {slot.content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={slot.onSelect}
      aria-label={slot.spokenLabel ?? slot.label}
      aria-pressed={slot.focused}
      className={`flex h-[var(--cell)] min-w-[calc(var(--cell)*2)] items-center justify-center rounded-md border-2 px-1 leading-none ${
        slot.focused
          ? 'border-bloom-500 bg-white text-ink-900'
          : slot.digits
            ? 'border-bloom-300 text-ink-900'
            : 'border-dashed border-bloom-200'
      }`}
    >
      {slot.digits || <span className="text-[0.4em] font-normal text-ink-400">{slot.label}</span>}
    </button>
  )
}
