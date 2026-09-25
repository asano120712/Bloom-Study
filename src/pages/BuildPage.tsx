import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'
import { PartsInput } from '@/components/PartsInput'
import { buildSession, type BuildItem } from '@/features/build'
import { useCopy } from '@/hooks/useAudienceMode'

/** 間違えたときに、正しい字を見せておく時間(ms) */
const ANSWER_MS = 1600

/**
 * かんじの くみたて(こども向けのあそび)。
 *
 * 小1・小2の漢字を、お手本を覚えてから部品で組み立てる。
 * この学年は熟語の穴うめが成立しないので、問題文のかわりに字そのものを見せる。
 *
 * 組み立ての操作・判定・組み上がりの演出は、おとな向けの「パーツを組む」と同じ
 * PartsInput をそのまま使う。違うのは、出題が熟語ではなくお手本の字であることだけ。
 */
export function BuildPage() {
  const copy = useCopy()

  const [items, setItems] = useState<BuildItem[]>(buildSession)
  const [index, setIndex] = useState(0)
  /** 「思い出した」を押したか。押すまではお手本を見せておく */
  const [revealed, setRevealed] = useState(false)
  /** 間違えたときだけ、正しい字を見せる */
  const [showAnswer, setShowAnswer] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const item = items[index]
  const isFinished = index >= items.length

  const next = () => {
    setRevealed(false)
    setShowAnswer(false)
    setIndex((current) => current + 1)
  }

  const finish = (first: string, second: string) => {
    const correct = first === item.assembly.first && second === item.assembly.second
    if (correct) {
      // 組み上がりは PartsInput が見せ終わっている
      next()
      return
    }
    // 間違いでも止めない。正しい字を見せてから次へ
    setShowAnswer(true)
    timer.current = window.setTimeout(next, ANSWER_MS)
  }

  const restart = () => {
    setItems(buildSession())
    setIndex(0)
    setRevealed(false)
    setShowAnswer(false)
  }

  if (isFinished) {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <BloomMark size={120} />
          <p className="text-2xl font-bold text-bloom-700">{copy.play.allDone}</p>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={restart}
              className="flex min-h-16 w-full items-center justify-center rounded-full bg-bloom-700 text-xl font-bold text-white"
            >
              {copy.play.again}
            </button>
            <Link to="/genres" className="text-base text-ink-400 underline">
              {copy.play.other}
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell fitViewport exitTo="/genres">
      <div className="flex shrink-0 items-center justify-center gap-2 pt-1">
        {items.map((each, position) => (
          <span
            key={each.char}
            className={`transition-opacity duration-500 ${
              position < index ? '' : 'opacity-20 grayscale'
            }`}
          >
            <BloomMark size={20} motion="none" />
          </span>
        ))}
      </div>

      {/* お手本。覚えたら引っこめる(見ながら組むと写すだけになる) */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col items-center justify-center">
        {(!revealed || showAnswer) && (
          <>
            <p className="text-center text-base text-ink-600">
              {showAnswer ? copy.build.answerIs : copy.build.look}
            </p>
            <p className="animate-bloom-in mt-2 font-display text-7xl leading-none text-bloom-700">
              {item.char}
            </p>
          </>
        )}
      </div>

      <PartsInput
        key={item.char}
        tiles={item.partTiles}
        layout={item.assembly.layout}
        // 組み上がるかどうかだけを渡す。正解の部品は画面に持たせない
        assembledOf={(first, second) =>
          first === item.assembly.first && second === item.assembly.second ? item.char : null
        }
        onReveal={() => setRevealed(true)}
        onSubmit={finish}
        disabled={showAnswer}
      />
    </AppShell>
  )
}
