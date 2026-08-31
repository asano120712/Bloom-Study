import { useEffect, useRef } from 'react'
import type { HintLayout, HintStep } from '@/types'

interface HintListProps {
  hints: HintStep[]
  layout: HintLayout
  secondsToNext: number | null
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
export function HintList({ hints, layout, secondsToNext }: HintListProps) {
  const isInline = layout === 'inline'
  const boxRef = useRef<HTMLDivElement>(null)

  // 枠に収まらない段数になっても、いま出たヒントは見えているようにする
  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [hints.length])

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div
        ref={boxRef}
        aria-live="polite"
        aria-label="ヒント"
        // 最低高さはレイアウトごとに1つだけ指定する(min-h-0 と併記すると
        // どちらが効くかが CSS の出力順に依存してしまう)
        className={`flex w-full flex-1 rounded-2xl bg-bloom-50 px-4 py-3 ${
          isInline
            ? 'min-h-14 items-center justify-center'
            : 'min-h-24 flex-col gap-2 overflow-y-auto'
        }`}
      >
        {hints.length === 0 ? (
          <span className="text-sm text-ink-400">まもなくヒントが出ます</span>
        ) : isInline ? (
          // 綴りを1文字ずつ連ねる。文字単位で浮かび上がらせたいので span を分ける
          <p className="text-3xl font-bold tracking-[0.2em] text-bloom-700">
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
              <span className="block text-xl tracking-widest text-bloom-700">{hint.text}</span>
            </div>
          ))
        )}
      </div>

      <p className="mt-2 text-center text-sm text-ink-400">
        {secondsToNext === null ? 'ヒントはここまで' : `つぎのヒントまで ${secondsToNext} 秒`}
      </p>
    </div>
  )
}
