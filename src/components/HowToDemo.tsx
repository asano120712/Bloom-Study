import { useEffect, useState } from 'react'
import { ActivityArt } from '@/components/ActivityArt'
import { ColumnForm } from '@/components/ColumnForm'
import { MemoIcon } from '@/components/MemoPad'
import type { ActivityId } from '@/data/activities'
import type { AnswerChoiceId } from '@/data/genres'
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
 * - `read`   手書きの字を読み取って、そのまま正解になるところ
 * - `slots`  パーツをへん・つくりの枠へ入れるところ
 * - `memo`   メモを開いて、自由に書くところ
 */
export type HowToDemoId = 'art' | 'hint' | 'column' | 'choice' | 'read' | 'slots' | 'memo'

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
        <ChoiceDemo activity={activity} />
      ) : id === 'read' ? (
        <ReadDemo activity={activity} />
      ) : id === 'memo' ? (
        <MemoDemo />
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

/**
 * そのあそびで選べるこたえかた。並びは、こたえかたを選ぶ画面と同じ。
 * 小1・2の漢字(なぞり書き・組み立て)は、あそびかたの文で別に書いてある。
 */
const CHOICES: Partial<Record<ActivityId, AnswerChoiceId[]>> = {
  english: ['handwriting', 'typing'],
  kanji: ['handwriting', 'assemble'],
  math: ['number', 'handwriting'],
}

/** こたえかたは選べる。選択肢の形だけを見せる(中身の字は本番で読む) */
function ChoiceDemo({ activity }: { activity: ActivityId }) {
  const copy = useCopy()
  const frame = useFrames(2)
  const choices = CHOICES[activity] ?? CHOICES.english!

  return (
    <div className="flex w-full max-w-64 flex-col gap-2">
      {choices.map((choice) => copy.answerModes[choice].label).map((label, index) => (
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

/**
 * 手書きは字を読み取る。マスに書くと、読み取って正解になる、というところ。
 * 計算は1マスに1字ずつ、漢字は1字を大きく、英単語は1つの枠に続けて書く。
 */
function ReadDemo({ activity }: { activity: ActivityId }) {
  const copy = useCopy()
  // 0: 空 → 1: 書く → 2: 正解
  const frame = useFrames(3)
  const chars = activity === 'math' ? ['3', '6'] : activity === 'english' ? ['water'] : ['水']
  const cell =
    activity === 'math' ? 'size-14 text-3xl' : activity === 'english' ? 'h-16 w-48 text-3xl' : 'size-20 text-5xl'

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex gap-1">
        {chars.map((char) => (
          <span
            key={char}
            className={`flex items-center justify-center rounded-xl border-2 bg-base-50 font-bold transition-colors duration-300 ${cell} ${
              frame >= 2 ? 'border-bloom-500 text-ink-900' : frame === 1 ? 'border-bloom-300 text-ink-600' : 'border-dashed border-bloom-200 text-transparent'
            }`}
            // 手で書いた字に見えるよう、少しだけ傾ける
            style={{ transform: 'rotate(-4deg)' }}
          >
            {char}
          </span>
        ))}
      </span>
      <span
        className={`rounded-full bg-bloom-700 px-4 py-1 text-sm font-bold text-white transition-opacity duration-500 ${
          frame >= 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {copy.verdicts.correct}
      </span>
    </div>
  )
}

/** メモは右上のボタンで開く。下の問題がうっすら透けて見える、というところ */
function MemoDemo() {
  // 0: 問題だけ → 1: メモを開く → 2: メモに書く
  const frame = useFrames(3)

  return (
    <div className="relative h-32 w-full max-w-64 overflow-hidden rounded-2xl bg-base-50">
      {/* 問題は左に。メモは右から重なり、問題の右端が透けて見える(本番の大きい画面と同じ置き方) */}
      <span className="absolute inset-y-0 left-4 flex items-center text-2xl font-bold text-ink-900">
        48 + 37
      </span>
      <span
        className={`absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
          frame >= 1 ? 'border-bloom-700 bg-bloom-700 text-white' : 'border-bloom-200 text-ink-600'
        }`}
      >
        <MemoIcon className="size-4" />
      </span>
      <span
        className={`absolute top-12 right-2 bottom-2 left-24 rounded-xl border-2 border-bloom-200 bg-base-50/80 transition-opacity duration-500 ${
          frame >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 走り書きのかわり。くり上がりの計算を書いているところ */}
        <svg viewBox="0 0 100 60" className="size-full p-2 text-ink-600" aria-hidden="true">
          <path
            d="M40 14 q6 -8 12 0 t12 0 M40 32 q6 -8 12 0 t12 0 M34 42 h40 M44 54 q6 -8 12 0 t12 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={`transition-opacity duration-500 ${frame >= 2 ? 'opacity-100' : 'opacity-0'}`}
          />
        </svg>
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
