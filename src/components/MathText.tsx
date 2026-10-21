import type { ReactNode } from 'react'
import { FRACTION_IN_TEXT } from '@/features/math'

/**
 * 文の中の分数を、分子を上・分母を下に積んで見せる。
 *
 * 問題もヒントも答えも、データとしては「2/3 + 1/4」「1 3/4」のように1行の文字で持つ
 * (記録・読み上げ・マイページの履歴は1行のほうが扱いやすい)。教科書と同じ形に積むのは
 * 見せる側の仕事なので、出題・ヒント・結果のどこでもこれを通す。
 * 分数を含まない文は、そのまま返す。
 */
export function MathText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(FRACTION_IN_TEXT)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    const [, whole, mixedNumerator, mixedDenominator, numerator, denominator] = match
    parts.push(
      whole ? (
        <span key={index} className="inline-flex items-center gap-[0.1em] align-middle">
          {whole}
          <StackedFraction numerator={mixedNumerator} denominator={mixedDenominator} />
        </span>
      ) : (
        <StackedFraction key={index} numerator={numerator} denominator={denominator} />
      ),
    )
    last = index + match[0].length
  }
  if (last === 0) return <>{text}</>
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/**
 * 分子・線・分母を縦に積んだ1つの分数。
 * 前後の文字と高さの真ん中をそろえる(線が式の記号「+」の高さに来るように)。
 */
export function StackedFraction({
  numerator,
  denominator,
}: {
  numerator: ReactNode
  denominator: ReactNode
}) {
  return (
    <span
      // 読み上げでは「3分の2」とは読めないので、元の書き方で読ませる
      // 行の高さは詰める。ヒントの枠のように高さの決まった場所でも、1行の分数が収まるように
      className="mx-[0.1em] inline-flex flex-col items-center align-middle leading-none tabular-nums"
    >
      <span className="px-[0.15em] pb-[0.05em] text-[0.8em]">{numerator}</span>
      <span aria-hidden="true" className="w-full border-t-[0.08em] border-current" />
      <span className="px-[0.15em] pt-[0.05em] text-[0.8em]">{denominator}</span>
    </span>
  )
}
