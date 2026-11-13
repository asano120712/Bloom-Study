import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Loading } from '@/components/layout/Loading'
import { questionsOf } from '@/data/questions'
import { Confetti, StampCardBook, StampChooser, TodayMeter } from '@/components/kids/StampCard'
import {
  ActivityChart,
  GenreBreakdown,
  HistoryCards,
  PeriodTabs,
  RecordDetailSheet,
  SummaryCards,
} from '@/components/record/RecordParts'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { usePressStage } from '@/hooks/usePressStage'
import { useStats } from '@/hooks/useStats'
import {
  STAMP_GOAL,
  dayKey,
  markCelebrated,
  needsCelebration,
  readStamps,
  type StampKind,
} from '@/services/stampCard'
import { summarize, type RecordPeriod } from '@/services/learningRecord'
import type { QuestionText } from '@/components/record/RecordParts'
import type { AnswerRecord } from '@/types'

/**
 * 履歴に出す出題語と正解。漢字は熟語を伏せた形(「◯犬」)なので、
 * 読みまで添えないとどの問題だったか分からない。
 * 新しい記録は出題語と正解の写しを持っているので、これを使うのは写しを持つ前の記録だけ。
 *
 * 問題データはジャンルごとに読み込むので、履歴に出ているジャンルのぶんだけを
 * 後から読む。読めるまでは id のまま出す(行の高さは変わらない)。
 */
function usePromptTexts(history: AnswerRecord[]): Map<string, QuestionText> {
  const [texts, setTexts] = useState<Map<string, QuestionText>>(new Map)

  // 履歴の中身が変わったときだけ読み直す。並び替えや再描画では読み直さない
  const key = history.map((record) => `${record.genreId}:${record.questionId}`).join(',')

  useEffect(() => {
    let cancelled = false
    const genres = [...new Set(history.map((record) => record.genreId))]

    void Promise.all(genres.map((genreId) => questionsOf(genreId))).then((lists) => {
      if (cancelled) return
      const found = new Map<string, QuestionText>()
      for (const question of lists.flat()) {
        found.set(question.id, {
          prompt: `${question.prompt}${question.promptReading ? `  ${question.promptReading}` : ''}`,
          answer: question.answer,
        })
      }
      setTexts(found)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return texts
}

/**
 * 記録のページ。こどもモードではスタンプカード、一般モードでは学びの記録を出す。
 * こどものあそびは正誤の記録を残さないので、こどもに見せるのはスタンプカードだけにする。
 */
export function MyPage() {
  return useAudienceMode() === 'kids' ? <KidsStampPage /> : <RecordPage />
}

/**
 * こどものスタンプカード。今日のスタンプが押されたのに、まだ押すところを見ていなければ
 * (あそびの途中で10回目に届いて、そのままやめたときなど)、開いたときに押す。
 * 押す前に、どのスタンプにするかを選んでもらう(選ばずに閉じたら、次に開いたときにまた選ぶ)。
 */
function KidsStampPage() {
  const copy = useCopy()
  const [data] = useState(readStamps)
  const [celebrate] = useState(() => needsCelebration(data))
  const [got, setGot] = useState(false)
  const [kind, setKind] = useState<StampKind>('flower')
  /** 押したあとは、今日のマスに選んだスタンプを出す(data は開いたときに読んだまま) */
  const [kinds, setKinds] = useState(data.kinds)
  const finishPress = useCallback(() => {
    markCelebrated(kind)
    setKinds((current) => ({ ...current, [dayKey()]: kind }))
    setGot(true)
  }, [kind])
  const { stage: pressStage, press } = usePressStage(celebrate, 600, finishPress)
  const choosing = pressStage === 'hold' || pressStage === 'lift'
  const today = data.plays[dayKey()] ?? 0

  return (
    <AppShell>
      <h1 className="text-center text-2xl font-bold">{copy.stampCard.title}</h1>

      <div className="relative mt-6">
        <StampCardBook plays={data.plays} kinds={kinds} pressStage={pressStage} pressKind={kind} />
        {got && <Confetti />}
      </div>

      {/*
        押す日は、選ぶところと今日の回数を同じ場所に重ね、高いほうの高さを取っておく
        (入れ替わるたびに、下の「あそびに いく」が上下に動かないように)。
      */}
      <div className="mt-6 grid">
        {celebrate && (
          <div className={`[grid-area:1/1] ${choosing ? 'animate-got-pop' : 'invisible'}`}>
            <StampChooser value={kind} onChange={setKind} onPress={press} disabled={pressStage === 'lift'} />
          </div>
        )}
        <div
          className={`flex flex-col items-center gap-2 text-center [grid-area:1/1] ${choosing ? 'invisible' : ''}`}
        >
          <TodayMeter count={today} />
          <p className="text-base font-bold text-ink-600">{copy.stampCard.today(today)}</p>
          {/* 押す演出のあいだは何も出さない(押す前に「ゲットずみ」と出ると、順番が逆になる) */}
          <p
            aria-live="polite"
            className={`min-h-7 text-lg font-bold text-warm-600 ${got ? 'animate-got-pop' : ''} ${
              celebrate && !got ? 'invisible' : ''
            }`}
          >
            {got
              ? copy.stampCard.got
              : today >= STAMP_GOAL
                ? copy.stampCard.already
                : copy.stampCard.left(STAMP_GOAL - today)}
          </p>
        </div>
      </div>

      <Link
        to="/genres"
        className="mt-8 flex min-h-16 items-center justify-center rounded-full bg-bloom-700 text-xl font-bold text-white"
      >
        {copy.stampCard.play}
      </Link>
    </AppShell>
  )
}

/**
 * 学びの記録(おとな)。期間(1日・1週間・1か月)を選んで、まとめ・グラフ・ジャンル別を見る。
 * 下に解いた問題をカードで並べ、押すとその時どう答えたかを見られる。
 */
function RecordPage() {
  const { stats, isLoading } = useStats()
  const copy = useCopy()
  const promptTexts = usePromptTexts(stats.history)
  const [period, setPeriod] = useState<RecordPeriod>('week')
  const [opened, setOpened] = useState<AnswerRecord | null>(null)
  const summary = useMemo(() => summarize(stats.buckets, period), [stats.buckets, period])
  const closeDetail = useCallback(() => setOpened(null), [])

  if (isLoading) {
    return (
      <AppShell>
        <Loading message={copy.myPage.loading} />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">{copy.myPage.title}</h1>

      <div className="mt-5 flex flex-col gap-4">
        <PeriodTabs value={period} onChange={setPeriod} />
        <SummaryCards summary={summary} currentStreak={stats.currentStreak} bestStreak={stats.bestStreak} />
        <ActivityChart summary={summary} />
        <GenreBreakdown summary={summary} />
      </div>

      {/*
        無料で解ける残り。いまは回数の制限が実質ないので出さない(制限を入れるときに戻す)。
        <p className="mt-4 text-sm text-ink-600">
          {copy.myPage.trialLeft(Math.max(0, TRIAL_LIMIT - stats.trialUsed))}
        </p>
      */}

      <h2 className="mt-8 text-lg font-bold">{copy.myPage.history}</h2>
      {stats.history.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">{copy.myPage.empty}</p>
      ) : (
        <div className="mt-3">
          <HistoryCards history={stats.history} lookup={promptTexts} onOpen={setOpened} />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/genres"
          className="flex min-h-14 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
        >
          {copy.myPage.solve}
        </Link>
      </div>

      {opened && <RecordDetailSheet record={opened} lookup={promptTexts} onClose={closeDetail} />}
    </AppShell>
  )
}
