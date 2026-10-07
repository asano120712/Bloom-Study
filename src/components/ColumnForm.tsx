import type { ReactNode } from 'react'
import { parseExpression, type ColumnSlot } from '@/features/math'

/** 筆算のマス1つぶん。打ち終わったもの・いま打っているものを、場所つきで表す */
export interface ColumnCell {
  slot: ColumnSlot
  /** 入っている数。空文字なら、まだ何も打っていない点線のマス */
  digits: string
  tone: CellTone
}

type CellTone = 'typing' | 'done' | 'corrected'

/** マス1つの幅。桁をそろえるため、段のずらし幅やわり算の桁位置でも同じ値を使う */
const CELL = '1.15em'

/**
 * 筆算(たし算・ひき算・かけ算)。式を縦に積んで、桁をそろえて見せる。
 * わり算は形が違う(商を上に書く)ので DivisionForm に分けてある。
 *
 * 2桁以上の計算を「24 × 5」と1行で出すと暗算に近くなり、小3・4には難しい。
 * 筆算はこの学年で習う形なので、縦に積むほうが解きやすく、位をそろえる練習にもなる。
 *
 * 式の文字列(「24 × 5」)から組み立てる。問題データは1行の式のまま持っておきたい
 * (マイページの履歴や読み上げは1行のほうが扱いやすい)ので、分けるのは見せる側で行う。
 * 読めない形だったときは、そのまま1行で出す。
 *
 * どこに何が入るかは `cells` が持つ。進み方(段で打つのか、位ごとに打つのか)は
 * 式で決まるので、その組み立ては `features/math` 側にまとめてある。
 */
export function ColumnForm({
  expression,
  cells = [],
  writeRow,
}: {
  expression: string
  cells?: ColumnCell[]
  /** 手書きで書き込むマス。渡すと、打つマスのかわりにここへ置く */
  writeRow?: ReactNode
}) {
  const parsed = parseExpression(expression)
  if (!parsed) return <span>{expression}</span>

  const { left, operator, right } = parsed
  const rows = cells.filter((cell) => cell.slot.kind === 'row')
  const places = cells.filter((cell) => cell.slot.kind === 'place')
  const answer = cells.find((cell) => cell.slot.kind === 'answer')

  return (
    // tabular-nums: 数字の幅をそろえて、位が縦に並ぶようにする
    <span
      // 読み上げには1行の式を渡す。縦に積んだ数字だけでは式として読まれない
      aria-label={expression}
      className="inline-grid grid-cols-[auto_auto] gap-x-3 text-right font-bold tabular-nums"
    >
      <span aria-hidden="true" />
      <span aria-hidden="true">{left}</span>
      <span aria-hidden="true">{operator}</span>
      <span aria-hidden="true">{right}</span>
      <span aria-hidden="true" className="col-span-2 mt-1 border-t-2 border-ink-900" />

      {/* かけ算の段。ずらして書くのも筆算と同じ */}
      {rows.map((cell, index) => (
        <Row
          key={index}
          digits={cell.digits}
          tone={cell.tone}
          shift={cell.slot.kind === 'row' ? cell.slot.shift : 0}
        />
      ))}

      {/* 段があるなら、答えの前にもう1本線を引く */}
      {rows.length > 0 && (
        <span aria-hidden="true" className="col-span-2 mt-1 border-t-2 border-ink-900" />
      )}

      {writeRow !== undefined ? (
        <span aria-hidden="true" className="col-span-2 mt-2 flex justify-end gap-1">
          {writeRow}
        </span>
      ) : (
        /*
          たし算・ひき算は一のくらいから打つので、右から左へ埋まっていく。
          打ち終わった位は右に残したまま、いま打っている位をその左に置く。
        */
        (places.length > 0 || answer) && (
          <span aria-hidden="true" className="col-span-2 mt-2 flex justify-end gap-1">
            {[...places].reverse().map((cell, index) => (
              <Digits key={index} digits={cell.digits} tone={cell.tone} />
            ))}
            {answer && <Digits digits={answer.digits} tone={answer.tone} />}
          </span>
        )
      )}
    </span>
  )
}

/** かけ算の段1つ。ずらす段は、その幅ぶん右を空ける */
function Row({ digits, shift, tone }: { digits: string; shift: number; tone: CellTone }) {
  return (
    <span
      aria-hidden="true"
      className="col-span-2 mt-2 flex justify-end gap-1"
      style={shift ? { paddingRight: `calc(${shift} * (${CELL} + 0.25rem))` } : undefined}
    >
      <Digits digits={digits} tone={tone} />
    </span>
  )
}

/**
 * 数をマスに1字ずつ。
 *
 * 打っているところは、**答えの桁数ぶんのマスは置かない**。マスの数が見えると
 * 桁数が分かってしまい、見当をつける手間が減る。打った数に追いて増える形にして、
 * まだ何も打っていないときだけ点線のマスを1つ出す。
 */
function Digits({ digits, tone }: { digits: string; tone: CellTone }) {
  return (
    <>
      {(digits ? [...digits] : ['']).map((digit, index) => (
        <span
          key={index}
          // 幅は CELL と同じ。Tailwind は書いたままの字面しか拾えないので、ここは直に書く
          className={`flex size-[1.15em] items-center justify-center rounded-md border-2 leading-none ${
            tone === 'corrected'
              ? 'border-warm-500 text-warm-600'
              : digit
                ? 'border-bloom-300 text-ink-900'
                : 'border-dashed border-bloom-200'
          }`}
        >
          {digit}
        </span>
      ))}
    </>
  )
}

/**
 * わり算の筆算(長除法)。割る数 │ 割られる数 の形にして、商を上に書く。
 *
 * かけ算の筆算と形が違うので別にしてある(縦に積むのではなく、囲って上に書く)。
 * 割られる数を1桁ずつマス目に置き、商・引く段・ひいた数を**その桁の下にそろえて**置く。
 * 桁がずれると、どの数からどれを引いたのかが読めなくなる。
 */
export function DivisionForm({
  expression,
  cells = [],
  writeRow,
}: {
  expression: string
  cells?: ColumnCell[]
  writeRow?: ReactNode
}) {
  const parsed = parseExpression(expression)
  if (!parsed || parsed.operator !== '÷') return <span>{expression}</span>

  const [dividend, divisor] = [parsed.left, parsed.right]
  const quotient = cells.filter((cell) => cell.slot.kind === 'quotient')
  const lines = cells.filter((cell) => cell.slot.kind === 'product' || cell.slot.kind === 'rest')

  /** 割られる数の桁(0始まり、左から)が、グリッドの何列目か。1列目は割る数 */
  const columnOf = (index: number) => index + 2

  /*
    引く段とひいた数は、1行ずつ下へ積む。ひいた数の上には線を引くので、その段は2行ぶん使う。
    線は紙と同じく**引く段の幅**に引く(ひいた数は、おろした桁のぶん右へ伸びるため)。
  */
  const placed = lines.reduce<Placed[]>((done, cell) => {
    const column = cell.slot.kind === 'product' || cell.slot.kind === 'rest' ? cell.slot.column : 0
    const span = Math.max(cell.digits.length, 1)
    const start = Math.max(2, columnOf(column) - span + 1)
    const above = done[done.length - 1]
    const top = above ? above.row + 1 : 3
    const ruled = cell.slot.kind === 'rest' && above !== undefined

    return [
      ...done,
      {
        cell,
        row: ruled ? top + 1 : top,
        start,
        span,
        rule: ruled ? { row: top, start: above.start, span: above.span } : undefined,
      },
    ]
  }, [])

  return (
    <span
      // 読み上げには1行の式を渡す。囲いと数字の位置だけでは式として読まれない
      aria-label={expression}
      className="inline-grid gap-1 text-right font-bold tabular-nums"
      style={{ gridTemplateColumns: `auto repeat(${dividend.length}, ${CELL})` }}
    >
      {/* 商。割られる数の、その桁の真上に置く */}
      {writeRow !== undefined ? (
        <span
          aria-hidden="true"
          className="flex justify-end gap-1"
          style={{ gridRow: 1, gridColumn: `2 / span ${dividend.length}` }}
        >
          {writeRow}
        </span>
      ) : (
        quotient.map((cell, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="flex justify-center"
            style={{
              gridRow: 1,
              gridColumn: cell.slot.kind === 'quotient' ? columnOf(cell.slot.column) : 2,
            }}
          >
            <Digits digits={cell.digits} tone={cell.tone} />
          </span>
        ))
      )}

      {/* 割る数 │ 割られる数 */}
      <span aria-hidden="true" className="self-center pr-1" style={{ gridRow: 2, gridColumn: 1 }}>
        {divisor}
      </span>
      {[...dividend].map((digit, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`border-t-2 border-ink-900 pt-1 text-center ${
            index === 0 ? 'rounded-tl-md border-l-2 pl-1' : ''
          }`}
          style={{ gridRow: 2, gridColumn: columnOf(index) }}
        >
          {digit}
        </span>
      ))}

      {/* 引く段とひいた数 */}
      {placed.map(({ cell, row, start, span, rule }, index) => (
        <span key={index} className="contents">
          {rule && (
            <span
              aria-hidden="true"
              className="mt-1 border-t-2 border-ink-900"
              style={{ gridRow: rule.row, gridColumn: `${rule.start} / span ${rule.span}` }}
            />
          )}
          <span
            aria-hidden="true"
            className="flex justify-end gap-1"
            style={{ gridRow: row, gridColumn: `${start} / span ${span}` }}
          >
            <Digits digits={cell.digits} tone={cell.tone} />
          </span>
        </span>
      ))}
    </span>
  )
}

/** 引く段・ひいた数を、グリッドのどこに置くか */
interface Placed {
  cell: ColumnCell
  row: number
  start: number
  span: number
  rule?: { row: number; start: number; span: number }
}
