import { useEffect, useRef } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import { MathText } from './MathText'
import type { HintLayout, HintStep } from '@/types'

interface HintListProps {
  hints: HintStep[]
  layout: HintLayout
  secondsToNext: number | null
  /**
   * 詰めて出す(計算の筆算のとき)。字を一回り小さくし、枠は3段がちょうど入る高さに固定する。
   * 計算のヒントは3段ぜんぶを同時に見て使うので、3段が入る高さより低くはしない。
   */
  compact?: boolean
  /**
   * ヒントに分数が入る(分数の問題)。分子を上・分母を下に積むと1行より背が高いので、
   * 詰めて出すときも枠を少し高くして、3段が入るようにする。
   */
  fractions?: boolean
}

/**
 * 開放済みヒントを「ひとつの枠の中でじわっと増えていく」形で見せる。
 *
 * 段階ごとに枠を積むのではなく、枠は最初から1つだけ置いて中身を足していく。
 * 追加された要素だけが animate-bloom-in でマウントされるので、
 * 既に出ているヒントは再生し直さない。
 *
 * 枠の高さは開放数によらず固定する。伸び縮みすると出題画面全体が動き、
 * 手書き中にスクロールが起きるため。
 */
export function HintList({
  hints,
  layout,
  secondsToNext,
  compact = false,
  fractions = false,
}: HintListProps) {
  const copy = useCopy()
  const isInline = layout === 'inline'
  const boxRef = useRef<HTMLDivElement>(null)

  // 枠に収まらない段数になっても、いま出たヒントは見えているようにする
  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [hints.length])

  return (
    // select-none: 手書き中になぞった指がここへ入っても、ヒントや残り秒数が
    // 範囲選択されない(選択の青枠が出ると書きかけの字が見えなくなる)
    <div className="flex min-h-0 w-full flex-1 flex-col select-none">
      <div
        ref={boxRef}
        aria-live="polite"
        aria-label="ヒント"
        // 最低高さはレイアウトごとに1つだけ指定する(min-h-0 と併記すると
        // どちらが効くかが CSS の出力順に依存してしまう)
        className={`flex w-full rounded-2xl bg-bloom-50 px-4 ${
          compact
            ? // 3段(24px × 3)+ すきま + 上下の余白 = 96px。分数が入ると1段が 30px ほどになる
              `${fractions ? 'h-28' : 'h-24'} flex-col gap-1 overflow-y-auto py-2`
            : isInline
              ? 'min-h-14 flex-1 items-center justify-center py-3'
              : 'min-h-24 flex-1 flex-col gap-2 overflow-y-auto py-3'
        }`}
      >
        {hints.length === 0 ? (
          <span className="text-sm text-ink-400">{copy.hints.waiting}</span>
        ) : isInline ? (
          // 綴りを1文字ずつ連ねる。文字単位で浮かび上がらせたいので span を分ける
          <p className="text-[min(1.875rem,8vw)] leading-9 font-bold tracking-[0.2em] text-bloom-700">
            {hints.map((hint) => (
              <span key={hint.index} className="animate-bloom-in inline-block">
                {hint.text}
              </span>
            ))}
          </p>
        ) : (
          hints.map((hint) => (
            <div key={hint.index} className="animate-bloom-in text-left">
              {hint.caption && <span className="block text-xs text-ink-400">{hint.caption}</span>}
              {/*
                文字の大きさを画面幅で頭打ちにする(狭い端末ほど小さくなる)。
                px で決め打ちにすると、端末の幅・フォント・文字サイズの設定しだいで
                枠から出る。幅に対する割合で上限を掛けておけば、どの幅でも収まる。
                それでも長い文は折り返す(2行になってよい)。
              */}
              <span
                className={`block tracking-wide break-words text-bloom-700 ${
                  compact ? 'text-base leading-6' : 'text-[min(1.25rem,5vw)] leading-7'
                }`}
              >
                {/* 分数のヒント(「2/3 = 8/12」)は、分子を上・分母を下に積んで見せる */}
                <MathText text={hint.text} />
              </span>
            </div>
          ))
        )}
      </div>

      <p className={`text-center text-ink-400 ${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'}`}>
        {secondsToNext === null ? copy.hints.done : copy.hints.next(secondsToNext)}
      </p>
    </div>
  )
}
