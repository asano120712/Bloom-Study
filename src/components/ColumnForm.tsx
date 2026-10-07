/**
 * 筆算。式を縦に積んで、桁をそろえて見せる。
 *
 * 2桁以上のかけ算を「24 × 5」と1行で出すと暗算に近くなり、小3・4には難しい。
 * 筆算はこの学年で習う形なので、縦に積むほうが解きやすく、位をそろえる練習にもなる。
 *
 * 式の文字列(「24 × 5」)から組み立てる。問題データは1行の式のまま持っておきたい
 * (マイページの履歴や読み上げは1行のほうが扱いやすい)ので、分けるのは見せる側で行う。
 * 読めない形だったときは、そのまま1行で出す。
 */
export function ColumnForm({ expression, typed }: { expression: string; typed?: string }) {
  const parsed = expression.match(/^(\d+)\s*([×÷+\-−])\s*(\d+)$/)
  if (!parsed) return <span>{expression}</span>

  const [, left, operator, right] = parsed

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

      {/* 答えを書くところ。紙の筆算と同じで、線のすぐ下に入る */}
      {typed !== undefined && <AnswerBoxes typed={typed} />}
    </span>
  )
}

/**
 * 答えのマス。打った数字ぶんと、次に入る空のマスを1つ出す。
 *
 * **答えの桁数ぶんは置かない。** マスの数が見えると「3桁になる」と分かってしまい、
 * 見当をつける手間が減る。打った数に追いて増える形なら、何も漏らさずに
 * 「ここに書く」とだけ伝えられる。
 */
function AnswerBoxes({ typed }: { typed: string }) {
  return (
    <span aria-hidden="true" className="col-span-2 mt-2 flex justify-end gap-1">
      {[...typed, ''].map((digit, index) => (
        <span
          key={index}
          className={`flex size-[1.15em] items-center justify-center rounded-md border-2 leading-none ${
            digit ? 'border-bloom-300 text-ink-900' : 'border-dashed border-bloom-200'
          }`}
        >
          {digit}
        </span>
      ))}
    </span>
  )
}
