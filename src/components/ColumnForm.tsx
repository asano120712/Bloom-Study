import type { ReactNode } from 'react'
import { parseExpression } from '@/features/math'

/** 筆算の1段。打ち終わった段と、いま打っている段を区別して出す */
export interface ColumnRow {
  /** その段に入る数 */
  value: string
  /** 右から何桁ずらすか。筆算の2段目は1つ左へ寄る */
  shift: number
  /** 打ち終わった段のうち、間違えていたもの(正しい数に直して見せる) */
  corrected?: boolean
}

/**
 * 筆算(たし算・ひき算・かけ算)。式を縦に積んで、桁をそろえて見せる。
 * わり算は形が違う(商を上に書く)ので DivisionForm に分けてある。
 *
 * 2桁以上のかけ算を「24 × 5」と1行で出すと暗算に近くなり、小3・4には難しい。
 * 筆算はこの学年で習う形なので、縦に積むほうが解きやすく、位をそろえる練習にもなる。
 *
 * 式の文字列(「24 × 5」)から組み立てる。問題データは1行の式のまま持っておきたい
 * (マイページの履歴や読み上げは1行のほうが扱いやすい)ので、分けるのは見せる側で行う。
 * 読めない形だったときは、そのまま1行で出す。
 */
export function ColumnForm({
  expression,
  typed,
  rows = [],
  typedShift = 0,
  writeRow,
}: {
  expression: string
  /** いま打っている数。渡すとマスが出る */
  typed?: string
  /** 打ち終わった途中の段 */
  rows?: ColumnRow[]
  /** いま打っている段のずらし幅 */
  typedShift?: number
  /** 手書きで書き込むマス。渡すと、打つマスのかわりにここへ置く */
  writeRow?: ReactNode
}) {
  const parsed = parseExpression(expression)
  if (!parsed) return <span>{expression}</span>

  const { left, operator, right } = parsed
  const hasSteps = rows.length > 0 || typedShift > 0

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

      {/* 打ち終わった途中の段。ずらして書くのも筆算と同じ */}
      {rows.map((row, index) => (
        <Boxes
          key={index}
          digits={[...row.value]}
          shift={row.shift}
          tone={row.corrected ? 'corrected' : 'done'}
        />
      ))}

      {/* 途中の段があるなら、答えの前にもう1本線を引く */}
      {hasSteps && rows.length > 0 && (
        <span aria-hidden="true" className="col-span-2 mt-1 border-t-2 border-ink-900" />
      )}

      {/*
        いま打っているところ。紙の筆算と同じで、線のすぐ下に入る。

        空のマスを出すのは、まだ何も打っていないときだけ。打った数の右に足すと、
        数がマス1つぶん左へずれて、上の段と位がそろわなくなる。
      */}
      {writeRow !== undefined ? (
        <span aria-hidden="true" className="col-span-2 mt-2 flex justify-end gap-1">
          {writeRow}
        </span>
      ) : (
        typed !== undefined && (
          <Boxes digits={typed ? [...typed] : ['']} shift={typedShift} tone="typing" />
        )
      )}
    </span>
  )
}

/**
 * 数字のマス。
 *
 * 打っている段は、**答えの桁数ぶんは置かない**。マスの数が見えると桁数が分かってしまい、
 * 見当をつける手間が減る。打った数に追いて増える形にして、
 * まだ何も打っていないときだけ点線のマスを1つ出す。
 */
function Boxes({
  digits,
  shift,
  tone,
  span = true,
}: {
  digits: string[]
  shift: number
  tone: 'typing' | 'done' | 'corrected'
  /** 2列ぶんに広げるか。わり算の商は右の列だけに置く */
  span?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`mt-2 flex justify-end gap-1 ${span ? 'col-span-2' : ''}`}
      // ずらした段は、その幅ぶん右を空ける(マス1つ + すきま)
      style={shift ? { paddingRight: `calc(${shift} * (1.15em + 0.25rem))` } : undefined}
    >
      {digits.map((digit, index) => (
        <span
          key={index}
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
    </span>
  )
}

/**
 * わり算の筆算。割る数 │ 割られる数 の形にして、商を上に書く。
 *
 * かけ算の筆算と形が違うので別にしてある(縦に積むのではなく、囲って上に書く)。
 * 商のマスは右づめ。右づめにすると、商のいちばん下の桁が割られる数の一の位の上に来て、
 * 筆算で習う位置とそのまま一致する(320 ÷ 5 なら 6 が 2 の上、4 が 0 の上)。
 *
 * 引く段(5 × 6 = 30 を書いて引く…)はまだ出さない。形と位置だけでも、
 * 1行の式より桁の見当がつけやすくなる。
 */
export function DivisionForm({
  expression,
  typed,
  writeRow,
}: {
  expression: string
  typed?: string
  /** 手書きで書き込むマス。渡すと、打つマスのかわりにここへ置く */
  writeRow?: ReactNode
}) {
  const parsed = parseExpression(expression)
  if (!parsed || parsed.operator !== '÷') return <span>{expression}</span>

  const [dividend, divisor] = [parsed.left, parsed.right]

  return (
    <span
      // 読み上げには1行の式を渡す。囲いと数字の位置だけでは式として読まれない
      aria-label={expression}
      className="inline-grid grid-cols-[auto_auto] gap-x-2 text-right font-bold tabular-nums"
    >
      {/* 商。割られる数の上にそろえたいので、下の枠と同じだけ左を空ける */}
      <span aria-hidden="true" />
      <span aria-hidden="true" className="pl-2">
        {writeRow !== undefined ? (
          <span className="mt-2 flex justify-end gap-1">{writeRow}</span>
        ) : typed !== undefined ? (
          <Boxes digits={typed ? [...typed] : ['']} shift={0} tone="typing" span={false} />
        ) : (
          <span className="invisible">0</span>
        )}
      </span>

      {/* 割る数 │ 割られる数 */}
      <span aria-hidden="true" className="self-center">
        {divisor}
      </span>
      <span
        aria-hidden="true"
        className="rounded-tl-md border-t-2 border-l-2 border-ink-900 pt-1 pl-2"
      >
        {dividend}
      </span>
    </span>
  )
}
