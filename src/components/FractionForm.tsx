import type { CSSProperties, ReactNode } from 'react'
import { MathText } from './MathText'

/** 分数のマス1つぶん(整数・分子・分母、途中式の分子・分母) */
export interface FractionSlot {
  /** 打った数(数字キーボード) */
  digits?: string
  /** 数のかわりに置くもの(手書きのマス) */
  content?: ReactNode
  /** いま打っているところ。枠を濃くして見せる */
  focused?: boolean
  /** タップで、ここに打つように切り替える(数字キーボード) */
  onSelect?: () => void
  /** 空のときに薄く出す名前(「分子」)。読み上げにも使う */
  label: string
  /** 読み上げだけ別の言い方にする(途中式の「とちゅうの式の分子」。答えの分子と区別するため) */
  spokenLabel?: string
}

/** 分子と分母のマスの組(1つの分数) */
export interface SlotPair {
  numerator: FractionSlot
  denominator: FractionSlot
}

/**
 * 途中式のマス。分数1つか、記号でつないだ分数2つ。
 * たし算・ひき算は通分した形(□/□ + □/□)、かけ算はかけた形(□/□)、
 * わり算は ひっくり返した形(□/□ × □/□)。
 */
export interface FractionWork {
  first: SlotPair
  /** 2つめの分数と、つなぐ記号。かけ算は1つだけなので無い */
  second?: { operator: string; pair: SlotPair }
}

/** 打つときのマス。字の大きさに合わせる(筆算の数のマスと同じ) */
const CELL = '1.15em'
/** 手書きのときのマス。書く場所に入る最大の大きさ(BoxHandwriting が測って渡す) */
const WRITE_CELL = 'var(--fit-cell, min(3rem, 7svh))'
/** 手書きのときの字。マスに合わせて大きくする(筆算と同じ 0.625 倍) */
const WRITE_FONT = 'calc(var(--cell) * 0.625)'

/**
 * 分数の式と、途中式・答えのマス。
 *
 * 答えは帯分数でも仮分数でも書けるよう、整数のマスを分数の左に置く(空でもよい)。
 * 途中式は紙と同じく、式と答えのあいだに「= 途中式」として置く。判定は答えだけで見る。
 *
 * 手書きのときは、書くマスを大きく取れるよう「式」「= 途中式」「= 答え」を3行に分ける。
 * 数字キーボードのときは、キーボードと同じ画面に入れるため「= 途中式 = 答え」を1行にする。
 */
export function FractionForm({
  expression,
  work,
  whole,
  numerator,
  denominator,
  writing = false,
}: {
  expression: string
  work?: FractionWork
  whole: FractionSlot
  numerator: FractionSlot
  denominator: FractionSlot
  writing?: boolean
}) {
  const workRow = work && (
    <span className="inline-flex items-center gap-[0.3em]">
      <span aria-hidden="true">=</span>
      <SlotFraction pair={work.first} />
      {work.second && (
        <>
          <span aria-hidden="true">{work.second.operator}</span>
          <SlotFraction pair={work.second.pair} />
        </>
      )}
    </span>
  )
  const answerRow = (
    <span className="inline-flex items-center gap-[0.3em]">
      <span aria-hidden="true">=</span>
      <Slot slot={whole} />
      <SlotFraction pair={{ numerator, denominator }} />
    </span>
  )

  return (
    <span
      aria-label={expression}
      data-fit-width={writing || undefined}
      // 手書きは幅を中身のまま(w-max)にする。画面の幅で縮められると、マスの大きさを決めるための幅が測れない
      className={`inline-flex flex-col items-center gap-2 font-bold tabular-nums ${writing ? 'w-max' : ''}`}
      style={
        {
          '--cell': writing ? WRITE_CELL : CELL,
          fontSize: writing ? WRITE_FONT : undefined,
        } as CSSProperties
      }
    >
      <span aria-hidden="true">
        <MathText text={expression} />
      </span>
      {writing ? (
        <>
          {workRow}
          {answerRow}
        </>
      ) : (
        // 幅が足りないときだけ、答えを次の行へ折り返す(字の大きい端末で、画面の幅を超えないように)
        <span className="inline-flex flex-wrap items-center justify-center gap-x-[0.3em] gap-y-2">
          {workRow}
          {answerRow}
        </span>
      )}
    </span>
  )
}

/** 分子・線・分母のマスを縦に積んだ1つの分数 */
function SlotFraction({ pair }: { pair: SlotPair }) {
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <Slot slot={pair.numerator} />
      <span aria-hidden="true" className="w-full border-t-[0.1em] border-current" />
      <Slot slot={pair.denominator} />
    </span>
  )
}

function Slot({ slot }: { slot: FractionSlot }) {
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
      className={`flex h-[var(--cell)] min-w-[calc(var(--cell)*1.4)] items-center justify-center rounded-md border-2 px-1 leading-none ${
        slot.focused
          ? 'border-bloom-500 bg-white text-ink-900'
          : slot.digits
            ? 'border-bloom-300 text-ink-900'
            : 'border-dashed border-bloom-200'
      }`}
    >
      {slot.digits || (
        // 空のマスには、どこに何を打つのかを薄く出す
        <span className="text-[0.4em] font-normal text-ink-400">{slot.label}</span>
      )}
    </button>
  )
}
