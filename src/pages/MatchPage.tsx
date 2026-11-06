import { useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PlayFinished, PlayProgress } from '@/components/PlayFrame'
import { FigureView } from '@/components/FigureView'
import { figureLabel, isSameFigure, matchSession, type Figure } from '@/features/match'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { addPlay } from '@/services/stampCard'

/** 「あたり!」を見せておく時間(ms)。押さなくても次へ進む */
const CELEBRATE_MS = 1100

/** 何回はずしたら、正解を光らせて助けるか */
const HINT_AFTER = 2

/**
 * おなじもの さがし(こども向けのあそび)。
 *
 * お手本と同じ図形を4つから選ぶ。ダミーは正解を1か所だけ変えて作ってあり、
 * 何を変えるか(形 → 色 → 向き)で難しさが上がる(src/features/match)。
 *
 * **はずしても止めない。** ×も減点も出さず、押したタイルが揺れて戻るだけ。
 * 続けてはずしたら正解を光らせる。解けずに終わらせないことを優先する。
 */
export function MatchPage() {
  const copy = useCopy()
  const isKids = useAudienceMode() === 'kids'

  const [problems, setProblems] = useState(matchSession)
  const [index, setIndex] = useState(0)
  /** いま揺らしているタイル(はずれ)。番号で持つ */
  const [missed, setMissed] = useState<number | null>(null)
  const [missCount, setMissCount] = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms))
  }

  const problem = problems[index]
  const isFinished = index >= problems.length

  const choose = (choice: Figure, position: number) => {
    if (celebrating || !problem) return

    if (!isSameFigure(choice, problem.answer)) {
      setMissed(position)
      setMissCount((count) => count + 1)
      // 揺れが終わったら元に戻す。押し直せる状態のままにしておく
      later(() => setMissed(null), 450)
      return
    }

    // こどものスタンプカード。当てた1問を1回と数える(当てるまで次へ進まない)
    if (isKids) addPlay()
    setCelebrating(true)
    later(() => {
      setCelebrating(false)
      setMissed(null)
      setMissCount(0)
      setIndex((current) => current + 1)
    }, CELEBRATE_MS)
  }

  const restart = () => {
    setProblems(matchSession())
    setIndex(0)
    setMissCount(0)
    setMissed(null)
    setCelebrating(false)
  }

  if (isFinished) {
    return (
      <AppShell>
        <PlayFinished onRestart={restart} played={problems.length} />
      </AppShell>
    )
  }

  const helping = missCount >= HINT_AFTER

  return (
    <AppShell fitViewport exitTo="/genres">
      <PlayProgress total={problems.length} done={index} />

      <p className="mt-3 shrink-0 text-center text-xl font-bold">{copy.match.question}</p>

      {/* お手本。選択肢より一回り大きく、離して置く */}
      <div className="mt-2 flex shrink-0 justify-center">
        <div className="size-24 rounded-3xl border-2 border-bloom-200 bg-white p-3 [@media(min-height:780px)]:size-28">
          <FigureView figure={problem.answer} />
        </div>
      </div>

      {/*
        4つの選択肢。親指で届くよう2×2に並べる。
        大きさは、置く場所の幅と高さの小さいほうに合わせる(cqw / cqh)。幅だけで決めると、
        背の低い画面(ブラウザのバーが出たスマホ、横向き)では上へはみ出してお手本にかぶり、
        高さに合わせようとして枠が縦長に伸びることもある。2×2のまとまりごと正方形にして、
        1つずつのマスも必ず正方形にする。
      */}
      <div className="mt-4 flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="grid aspect-square w-[min(100cqw,100cqh)] grid-cols-2 grid-rows-2 gap-3">
          {problem.choices.map((choice, position) => {
            const isAnswer = isSameFigure(choice, problem.answer)
            return (
              <button
                key={`${figureLabel(choice)}-${position}`}
                type="button"
                // 図形そのものは読み上げられないので、名前はボタンが持つ
                aria-label={figureLabel(choice)}
                onClick={() => choose(choice, position)}
                className={`flex size-full min-h-0 min-w-0 items-center justify-center rounded-3xl border-2 bg-white p-4 ${
                  celebrating && isAnswer ? 'border-bloom-500 bg-bloom-50' : 'border-bloom-200'
                } ${missed === position ? 'animate-shake' : ''} ${
                  // 点滅だけだと薄れて見えるので、枠と地も変えて「ここ」と分かるようにする
                  helping && isAnswer ? 'animate-pulse border-bloom-500 bg-bloom-50' : ''
                }`}
              >
                <FigureView figure={choice} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex h-12 shrink-0 items-center justify-center">
        {celebrating ? (
          <p className="animate-bloom-in text-2xl font-bold text-bloom-700">{copy.match.correct}</p>
        ) : (
          helping && <p className="text-center text-base text-ink-600">{copy.match.hint}</p>
        )}
      </div>
    </AppShell>
  )
}
