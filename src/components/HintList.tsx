import type { HintStep } from '@/types'

interface HintListProps {
  hints: HintStep[]
  secondsToNext: number | null
}

/** 開放済みヒントを「じわっと浮かび上がる」演出付きで並べる */
export function HintList({ hints, secondsToNext }: HintListProps) {
  return (
    <div className="w-full">
      <ul className="flex flex-col gap-2">
        {hints.map((hint) => (
          <li
            key={hint.index}
            className="animate-bloom-in rounded-2xl bg-bloom-50 px-4 py-3 text-left"
          >
            {hint.caption && (
              <span className="block text-xs text-ink-400">{hint.caption}</span>
            )}
            <span className="block text-xl tracking-widest text-bloom-700">{hint.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-center text-sm text-ink-400">
        {secondsToNext === null
          ? 'ヒントはここまで'
          : `つぎのヒントまで ${secondsToNext} 秒`}
      </p>
    </div>
  )
}
