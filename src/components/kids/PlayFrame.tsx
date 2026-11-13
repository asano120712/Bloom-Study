import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { usePressStage } from '@/hooks/usePressStage'
import {
  STAMP_GOAL,
  dayKey,
  markCelebrated,
  needsCelebration,
  readStamps,
  type StampKind,
} from '@/services/stampCard'
import { prefersReducedMotion } from '@/utils/motion'
import { BloomMark } from '../brand/BloomMark'
import { Confetti, StampCardSheet, StampChooser, TodayMeter } from './StampCard'

/**
 * あそび(なぞりがき・おなじものさがし)の、進み具合と終わりの画面。
 *
 * こどもは字や数を読めない年齢も来るので、できた数を花で見せ、終わりは花が喜ぶ。
 * おとな(小1・2の漢字を選んだとき)は、出題と同じく「何問目」を字で出し、
 * 終わりも結果画面と同じく落ち着いた見せ方にする(喜ぶ顔はこども向けだけ)。
 */
export function PlayProgress({ total, done }: { total: number; done: number }) {
  const copy = useCopy()
  const isKids = useAudienceMode() === 'kids'

  if (!isKids) {
    return (
      <p aria-live="polite" className="shrink-0 pt-1 text-center text-sm font-bold text-ink-600">
        {copy.play.progress(Math.min(done + 1, total), total)}
      </p>
    )
  }

  return (
    // できた数を花で出す。数字より、増えていくのが見えるほうが分かりやすい
    <div className="flex shrink-0 items-center justify-center gap-2 pt-1">
      {Array.from({ length: total }, (_, position) => (
        <span
          key={position}
          className={`transition-opacity duration-500 ${position < done ? '' : 'opacity-20 grayscale'}`}
        >
          <BloomMark size={20} motion="none" />
        </span>
      ))}
    </div>
  )
}

export function PlayFinished({ onRestart, played }: { onRestart: () => void; played: number }) {
  const copy = useCopy()
  const isKids = useAudienceMode() === 'kids'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {isKids ? (
        <KidsStamp played={played} />
      ) : (
        <>
          <BloomMark size={80} />
          <p className="text-2xl font-bold text-bloom-700">{copy.play.allDone}</p>
        </>
      )}

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-16 w-full items-center justify-center rounded-full bg-bloom-700 text-xl font-bold text-white"
        >
          {copy.play.again}
        </button>
        <Link
          to="/genres"
          className="flex min-h-14 items-center justify-center rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600"
        >
          {copy.play.other}
        </Link>
      </div>
    </div>
  )
}

/**
 * こどもの終わりの画面の、スタンプカードのところ。
 *
 * 今日のスタンプが押されたばかり(まだ押すところを見せていない)なら、まず今日の玉が
 * 10個そろって「10かい たまった!」を見せ、そのあとでスタンプカードを出して押す。
 * いきなりカードが出ると、なぜスタンプがもらえたのかが分からない。
 * まだ届いていなければ、今日の回数を玉で見せ、あと何回かを伝える。
 * played は、このあそびで増えた回数(その玉だけ、はずむように埋まる)。
 */
function KidsStamp({ played }: { played: number }) {
  const copy = useCopy()
  // 読むのは開いたときの1回だけ。押し終えた印を書いたあとに読み直すと、演出の途中で消えてしまう
  const [data] = useState(readStamps)
  const [celebrate] = useState(() => needsCelebration(data))
  /** 10回たまったのを見せ終えて、スタンプカードに移ったか */
  const [showCard, setShowCard] = useState(false)
  const today = data.plays[dayKey()] ?? 0

  if (celebrate && showCard) return <StampCelebration plays={data.plays} kinds={data.kinds} />

  return (
    <>
      <BloomMark size={110} face="joy" />
      <p className="text-2xl font-bold text-bloom-700">{copy.play.allDone}</p>
      <div className="flex flex-col gap-2">
        <TodayMeter count={today} added={played} />
        {celebrate ? (
          <GoalReached added={Math.min(played, STAMP_GOAL)} onDone={() => setShowCard(true)} />
        ) : (
          <p className="text-base font-bold text-ink-600">
            {today >= STAMP_GOAL ? copy.stampCard.already : copy.stampCard.left(STAMP_GOAL - today)}
          </p>
        )}
      </div>
    </>
  )
}

/** 玉が1つ埋まるのにかかる時間の合わせ(TodayMeter の遅れ 300ms + 1つごと 130ms + はずみ 420ms) */
const meterDoneMs = (added: number) => 300 + Math.max(0, added - 1) * 130 + 420
/** 「10かい たまった!」を見せておく時間。読めるだけ待ってから、カードに移る */
const REACHED_HOLD_MS = 1600

/**
 * 「10かい たまった!」。玉がそろったところで、はずむように出す。
 * 少し見せてから onDone でスタンプカードに移る。動きを減らす設定では待たない。
 */
function GoalReached({ added, onDone }: { added: number; onDone: () => void }) {
  const copy = useCopy()
  const [shown, setShown] = useState(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    const still = prefersReducedMotion()
    const show = window.setTimeout(() => setShown(true), still ? 0 : meterDoneMs(added))
    const next = window.setTimeout(() => done.current(), still ? 600 : meterDoneMs(added) + REACHED_HOLD_MS)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(next)
    }
  }, [added])

  return (
    <p
      aria-live="polite"
      className={`min-h-8 text-2xl font-bold text-warm-600 ${shown ? 'animate-got-pop' : 'invisible'}`}
    >
      {copy.stampCard.reached(STAMP_GOAL)}
    </p>
  )
}

/**
 * スタンプカードを出して、今日のマスに押す。カードがせり上がりきってからスタンプが浮かび、
 * どのスタンプにするか選んで、押すボタンで押す。
 */
function StampCelebration({ plays, kinds }: { plays: Record<string, number>; kinds: Record<string, StampKind> }) {
  const copy = useCopy()
  const [got, setGot] = useState(false)
  const [kind, setKind] = useState<StampKind>('flower')
  const [stamped, setStamped] = useState(kinds)
  const finishPress = useCallback(() => {
    markCelebrated(kind)
    setStamped((current) => ({ ...current, [dayKey()]: kind }))
    setGot(true)
  }, [kind])
  const { stage: pressStage, press } = usePressStage(true, 800, finishPress)
  const choosing = pressStage === 'hold' || pressStage === 'lift'

  return (
    <>
      <p className="text-2xl font-bold text-bloom-700">{copy.play.allDone}</p>
      <div className="animate-card-rise relative w-full">
        <div className={pressStage === 'press' ? 'animate-card-thud' : ''}>
          <StampCardSheet plays={plays} kinds={stamped} pressStage={pressStage} pressKind={kind} />
        </div>
        {got && <Confetti />}
      </div>
      {/*
        選ぶところと「スタンプ ゲット!」を同じ場所に重ねて、選ぶところのぶんの高さをずっと取っておく。
        入れ替わるたびに高さが変わると、真ん中に寄せているカードが上下に跳ねる。
      */}
      <div className="grid w-full place-items-center">
        <div className={`w-full [grid-area:1/1] ${choosing ? 'animate-got-pop' : 'invisible'}`}>
          <StampChooser value={kind} onChange={setKind} onPress={press} disabled={pressStage === 'lift'} />
        </div>
        <p
          aria-live="polite"
          className={`flex min-h-10 items-center gap-2 text-2xl font-bold text-warm-600 [grid-area:1/1] ${got ? 'animate-got-pop' : 'invisible'}`}
        >
          <BloomMark size={36} face="joy" motion="none" />
          {copy.stampCard.got}
        </p>
      </div>
    </>
  )
}
