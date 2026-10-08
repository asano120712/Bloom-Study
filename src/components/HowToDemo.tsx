import { useEffect, useState } from 'react'
import { ActivityArt } from '@/components/ActivityArt'
import { ColumnForm } from '@/components/ColumnForm'
import type { ActivityId } from '@/data/activities'
import { useCopy } from '@/hooks/useAudienceMode'
import { prefersReducedMotion } from '@/utils/motion'

/**
 * あそびかたの、手順ごとの小さなデモ。
 *
 * 文だけだと「段ごとに打つ」「ヒントが増える」が伝わらない。
 * 手順の横に本物と同じ見た目で動かすと、読まなくても何が起きるのか分かる。
 *
 * - `art`    そのあそびの絵(一覧のカードと同じもの)
 * - `hint`   ヒントが1つずつ増えるところ
 * - `column` 筆算が段ごとに埋まり、まちがいが赤枠になって打ち直すところ
 * - `choice` こたえかたを選ぶところ
 * - `self`   手書きのあと、自分で合っていたかを選ぶところ
 * - `slots`  パーツをへん・つくりの枠へ入れるところ
 */
export type HowToDemoId = 'art' | 'hint' | 'column' | 'choice' | 'self' | 'slots'

/** 動きの1こまぶん。短すぎると読む前に次へ行く */
const TICK_MS = 1100

/** こまを順に送る。「動きを減らす」設定のときは、できあがった形で止める */
function useFrames(count: number): number {
  const [still] = useState(prefersReducedMotion)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (still || count <= 1) return
    const id = window.setInterval(() => setFrame((current) => (current + 1) % count), TICK_MS)
    return () => window.clearInterval(id)
  }, [still, count])

  return still ? count - 1 : frame
}

export function HowToDemo({ id, activity }: { id: HowToDemoId; activity: ActivityId }) {
  return (
    // 高さを決めておく。手順を送るたびに枠の高さが変わると、ボタンの位置が動く
    <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-bloom-100 px-4">
      {id === 'art' ? (
        <ActivityArt id={activity} className="size-32" />
      ) : id === 'hint' ? (
        <HintDemo />
      ) : id === 'column' ? (
        <ColumnDemo />
      ) : id === 'choice' ? (
        <ChoiceDemo />
      ) : id === 'self' ? (
        <SelfReportDemo activity={activity} />
      ) : (
        <SlotsDemo />
      )}
    </div>
  )
}

/** ヒントは時間がたつと1つずつ増える。待つほどやさしくなる、というところ */
function HintDemo() {
  const frame = useFrames(4)

  return (
    <div className="w-full max-w-64 rounded-2xl bg-base-50 p-3">
      <ul className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className={`h-3 rounded-full transition-opacity duration-500 ${
              index < frame ? 'bg-bloom-300 opacity-100' : 'bg-bloom-200 opacity-0'
            }`}
            // 下の行ほど短く。字の代わりなので、文章らしい形にだけ見せる
            style={{ width: `${100 - index * 18}%` }}
          />
        ))}
      </ul>
    </div>
  )
}

/**
 * 筆算は段ごとに打つ。まちがえると赤枠になり、打ち直すと先へ進む。
 *
 * 本物の筆算([ColumnForm](src/components/ColumnForm.tsx))に、
 * 打ち終わった段を順に渡していく。見た目が本番と同じになる。
 */
const COLUMN_DEMO = { expression: '98 × 7', rows: ['56', '63'], answer: '686' } as const

function ColumnDemo() {
  // 0: 空 → 1: 1だんめ → 2: 2だんめをまちがえる(赤) → 3: 打ち直す → 4: こたえ
  const frame = useFrames(5)

  const cells = [
    ...(frame >= 1
      ? [
          {
            slot: { kind: 'row', shift: 0 } as const,
            digits: COLUMN_DEMO.rows[0],
            tone: 'done' as const,
          },
        ]
      : []),
    ...(frame >= 2
      ? [
          {
            slot: { kind: 'row', shift: 1 } as const,
            digits: frame === 2 ? '36' : COLUMN_DEMO.rows[1],
            tone: frame === 2 ? ('wrong' as const) : ('done' as const),
          },
        ]
      : []),
    ...(frame >= 4
      ? [{ slot: { kind: 'answer' } as const, digits: COLUMN_DEMO.answer, tone: 'done' as const }]
      : []),
  ]

  return (
    <p className="text-xl leading-6 font-bold">
      <ColumnForm expression={COLUMN_DEMO.expression} cells={cells} />
    </p>
  )
}

/** こたえかたは選べる。選択肢の形だけを見せる(中身の字は本番で読む) */
function ChoiceDemo() {
  const copy = useCopy()
  const frame = useFrames(2)

  return (
    <div className="flex w-full max-w-64 flex-col gap-2">
      {[copy.answerModes.handwriting.label, copy.answerModes.typing.label].map((label, index) => (
        <span
          key={label}
          className={`flex min-h-12 items-center rounded-2xl px-4 text-base font-bold transition-colors duration-300 ${
            index === frame ? 'bg-bloom-700 text-white' : 'bg-base-50 text-ink-600'
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

/** 手書きは字を読み取らない。書けたら自分で選ぶ、というところ */
function SelfReportDemo({ activity }: { activity: ActivityId }) {
  const copy = useCopy()
  const frame = useFrames(2)

  return (
    <div className="flex w-full max-w-64 flex-col items-center gap-3">
      <span className="flex h-16 w-full items-center justify-center rounded-2xl bg-base-50 text-3xl font-bold text-ink-900">
        {/* 書いたもののかわり。そのあそびで書くものに合わせる */}
        {activity === 'english' ? 'water' : '水'}
      </span>
      <span className="flex w-full gap-2">
        {/*
          押されて見えるのは「できた」だけにする。両方を順に光らせると、
          「ちがった」を選ぶのが筋のように見えてしまう。
        */}
        <span
          className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors duration-500 ${
            frame === 1 ? 'bg-bloom-700 text-white' : 'border-2 border-bloom-200 text-ink-600'
          }`}
        >
          {copy.quiz.right}
        </span>
        <span className="flex min-h-11 flex-1 items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600">
          {copy.quiz.wrong}
        </span>
      </span>
    </div>
  )
}

/** パーツはへん・つくりの枠へ入れる。入ると漢字になる、というところ */
function SlotsDemo() {
  const frame = useFrames(3)

  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1 rounded-2xl bg-base-50 p-2 text-3xl font-bold">
        {['氵', '每'].map((part, index) => (
          <span
            key={part}
            className={`flex size-14 items-center justify-center rounded-xl border-2 transition-colors duration-300 ${
              frame > index
                ? 'border-bloom-300 text-ink-900'
                : 'border-dashed border-bloom-200 text-transparent'
            }`}
          >
            {part}
          </span>
        ))}
      </span>

      {/* 枠が埋まると、こうなるというところ */}
      <span
        aria-hidden="true"
        className={`text-xl text-ink-400 transition-opacity duration-500 ${
          frame >= 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        →
      </span>
      <span
        className={`text-4xl font-bold text-bloom-700 transition-opacity duration-500 ${
          frame >= 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        海
      </span>
    </div>
  )
}
