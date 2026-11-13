import { useEffect, useRef } from 'react'
import { PartTile } from '@/components/input/PartTile'
import { useCopy } from '@/hooks/useAudienceMode'
import { RECORD_PERIODS, percent, type RecordPeriod, type RecordSummary } from '@/services/learningRecord'
import { dayKey } from '@/services/stampCard'
import type { AnswerRecord, GenreId } from '@/types'

/**
 * 学びの記録(MyPage の RecordPage)の部品。
 * 期間の切り替え → まとめのカード → 棒グラフ → ジャンル別 → 解いた問題のカード、の順に並ぶ。
 * カードを押すと、その問題でどう答えたかをシートで見せる。
 */

/** ジャンルごとの色。カードの札とジャンル別の棒をそろえる */
const GENRE_COLOR: Record<GenreId, { chip: string; bar: string }> = {
  english: { chip: 'bg-bloom-100 text-bloom-700', bar: 'bg-bloom-500' },
  kanji: { chip: 'bg-warm-100 text-warm-600', bar: 'bg-warm-500' },
  math: { chip: 'bg-base-100 text-ink-600', bar: 'bg-ink-400' },
}

export function PeriodTabs({ value, onChange }: { value: RecordPeriod; onChange: (period: RecordPeriod) => void }) {
  const copy = useCopy()
  return (
    <div role="tablist" className="flex gap-1 rounded-full bg-bloom-50 p-1">
      {RECORD_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="tab"
          aria-selected={period === value}
          onClick={() => onChange(period)}
          className={`min-h-10 flex-1 rounded-full text-sm font-bold ${
            period === value ? 'bg-bloom-700 text-white' : 'text-ink-600'
          }`}
        >
          {copy.myPage.periods[period]}
        </button>
      ))}
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-bloom-50 px-3 py-3 text-center">
      {/* break-keep: 狭いタイルで語の途中で折れないように、空白でだけ折る */}
      <p className="text-xs break-keep text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-bloom-700">{value}</p>
      {sub && <p className="text-xs text-ink-400">{sub}</p>}
    </div>
  )
}

/** まとめのカード。解いた数・正解率・ヒントなしは選んだ期間、連続は期間によらない */
export function SummaryCards({
  summary,
  currentStreak,
  bestStreak,
}: {
  summary: RecordSummary
  currentStreak: number
  bestStreak: number
}) {
  const copy = useCopy()
  const { a, c, n } = summary.total
  const show = (value: number | null) => (value === null ? copy.myPage.none : `${value}%`)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Card label={copy.myPage.answered} value={`${a}`} />
      <Card label={copy.myPage.accuracy} value={show(percent(c, a))} />
      <Card label={copy.myPage.noHint} value={show(percent(n, a))} />
      <Card label={copy.myPage.currentStreak} value={`${currentStreak}`} sub={copy.myPage.bestStreak(bestStreak)} />
    </div>
  )
}

/** 解いた数の棒グラフ。正解(緑)と不正解(薄いオレンジ)を積む */
export function ActivityChart({ summary }: { summary: RecordSummary }) {
  const copy = useCopy()
  const max = Math.max(1, ...summary.bars.map((bar) => bar.count.a))
  return (
    <section className="rounded-3xl border-2 border-bloom-100 bg-white px-4 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{copy.myPage.chart}</h2>
        <p className="flex gap-3 text-xs text-ink-600">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-bloom-500" />
            {copy.myPage.chartCorrect}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-warm-500/50" />
            {copy.myPage.chartIncorrect}
          </span>
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-400">{max > 1 ? `↑ ${max}` : ''}</p>
      <ol className="mt-1 flex h-32 items-end gap-0.5 border-b border-bloom-100">
        {summary.bars.map((bar) => (
          <li
            key={bar.name}
            aria-label={copy.myPage.bar(bar.name, bar.count.a, bar.count.c)}
            className="flex h-full flex-1 flex-col justify-end"
          >
            {bar.count.a > bar.count.c && (
              <span
                className="rounded-t-sm bg-warm-500/50"
                style={{ height: `${((bar.count.a - bar.count.c) / max) * 100}%` }}
              />
            )}
            {bar.count.c > 0 && (
              <span
                className={`bg-bloom-500 ${bar.count.a === bar.count.c ? 'rounded-t-sm' : ''}`}
                style={{ height: `${(bar.count.c / max) * 100}%` }}
              />
            )}
          </li>
        ))}
      </ol>
      <ol aria-hidden="true" className="mt-1 flex gap-0.5">
        {summary.bars.map((bar) => (
          // 目盛りは棒より広く取りたいので、はみ出しを許して真ん中にそろえる
          <li key={bar.name} className="relative flex-1 text-center text-[0.65rem] text-ink-400">
            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{bar.label}</span>
          </li>
        ))}
      </ol>
      <div className="h-4" />
    </section>
  )
}

/** ジャンル別の正解率。解いていないジャンルは棒を出さずに「—」 */
export function GenreBreakdown({ summary }: { summary: RecordSummary }) {
  const copy = useCopy()
  return (
    <section className="rounded-3xl border-2 border-bloom-100 bg-white px-4 py-4">
      <h2 className="text-base font-bold">{copy.myPage.genres}</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {(Object.keys(summary.byGenre) as GenreId[]).map((genre) => {
          const { a, c } = summary.byGenre[genre]
          const rate = percent(c, a)
          return (
            <li key={genre} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 font-bold text-ink-900">{copy.activities[genre].label}</span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-base-100">
                {rate !== null && (
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full ${GENRE_COLOR[genre].bar}`}
                    style={{ width: `${rate}%` }}
                  />
                )}
              </span>
              <span className="w-16 shrink-0 text-right text-ink-600">
                {rate === null ? copy.myPage.none : `${rate}%`}
                <span className="ml-1 text-xs text-ink-400">{a > 0 ? `(${a})` : ''}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 写しを持つ前の記録のために、問題データから引いた出題語と正解 */
export interface QuestionText {
  prompt: string
  answer: string
}

/** カードと詳細に出す出題語。新しい記録は写しを、古い記録は問題データから引いたものを使う */
const promptOf = (record: AnswerRecord, lookup: Map<string, QuestionText>) =>
  record.prompt !== undefined
    ? `${record.prompt}${record.promptReading ? `  ${record.promptReading}` : ''}`
    : (lookup.get(record.questionId)?.prompt ?? record.questionId)

/** 解いた問題のカード。日ごとにまとめる(今日・きのう・それより前は日付) */
export function HistoryCards({
  history,
  lookup,
  onOpen,
}: {
  history: AnswerRecord[]
  lookup: Map<string, QuestionText>
  onOpen: (record: AnswerRecord) => void
}) {
  const copy = useCopy()
  const today = dayKey()
  const now = new Date()
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const groups = new Map<string, AnswerRecord[]>()
  for (const record of history) {
    const day = dayKey(new Date(record.answeredAt))
    groups.set(day, [...(groups.get(day) ?? []), record])
  }
  const titleOf = (day: string) =>
    day === today ? copy.myPage.today : day === yesterday ? copy.myPage.yesterday : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`

  return (
    <div className="flex flex-col gap-5">
      {[...groups].map(([day, records]) => (
        <section key={day}>
          <h3 className="text-sm font-bold text-ink-600">{titleOf(day)}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {records.map((record, index) => (
              <li key={`${record.questionId}-${record.answeredAt}-${index}`}>
                <button
                  type="button"
                  onClick={() => onOpen(record)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-bloom-100 bg-white px-4 py-3 text-left"
                >
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${GENRE_COLOR[record.genreId].chip}`}>
                    {copy.activities[record.genreId].label}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-bold text-ink-900">{promptOf(record, lookup)}</span>
                    <span className="text-xs text-ink-400">
                      {copy.answerModes[record.inputMode].label}・{copy.myPage.hintsUsed(record.hintsUsed)}
                      {record.durationMs !== undefined && `・${copy.myPage.seconds(Math.round(record.durationMs / 1000))}`}
                    </span>
                  </span>
                  {/* 正誤は色だけに頼らず、記号でも見せる */}
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                      record.isCorrect ? 'bg-bloom-100 text-bloom-700' : 'bg-warm-100 text-warm-600'
                    }`}
                  >
                    {record.isCorrect ? '○' : '×'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 1問の中身。正解・自分の答え・見たヒント・かかった時間・答え方 */
export function RecordDetailSheet({
  record,
  lookup,
  onClose,
}: {
  record: AnswerRecord
  lookup: Map<string, QuestionText>
  onClose: () => void
}) {
  const copy = useCopy()
  const dialogRef = useRef<HTMLDivElement>(null)
  const { detail } = copy.myPage

  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const given = record.given
  const correctAnswer = record.answer ?? lookup.get(record.questionId)?.answer
  const answered = new Date(record.answeredAt)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-5 sm:py-6">
      <button type="button" aria-label={detail.close} onClick={onClose} className="absolute inset-0 bg-ink-900/40" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={promptOf(record, lookup)}
        tabIndex={-1}
        className="animate-bloom-in relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-base-50 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none sm:rounded-3xl"
      >
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${GENRE_COLOR[record.genreId].chip}`}>
            {copy.activities[record.genreId].label}
          </span>
          <span className="text-xs text-ink-400">
            {answered.getMonth() + 1}月{answered.getDate()}日 {answered.getHours()}:
            {String(answered.getMinutes()).padStart(2, '0')}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-bold">{promptOf(record, lookup)}</h2>
        <p className={`mt-1 text-base font-bold ${record.isCorrect ? 'text-bloom-700' : 'text-warm-600'}`}>
          {record.isCorrect ? '○' : '×'} {copy.verdicts[record.verdict]}
        </p>

        <dl className="mt-4 flex flex-col gap-3">
          <Row label={detail.correctAnswer}>
            {correctAnswer ? (
              <span className="text-xl font-bold">{correctAnswer}</span>
            ) : (
              <span className="text-sm text-ink-400">{detail.notSaved}</span>
            )}
          </Row>
          <Row label={detail.yourAnswer}>
            {!given ? (
              <span className="text-sm text-ink-400">{detail.notSaved}</span>
            ) : given.kind === 'text' ? (
              <span className={`text-xl font-bold ${record.isCorrect ? 'text-ink-900' : 'text-warm-600'}`}>
                {given.text || '—'}
              </span>
            ) : given.kind === 'parts' ? (
              <span className="flex gap-2 text-3xl">
                {given.parts.map((part, index) => (
                  <span key={index} className="rounded-xl border-2 border-bloom-100 bg-white px-2 py-1">
                    <PartTile id={part} />
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm text-ink-600">{detail.handwriting}</span>
            )}
          </Row>
          <Row label={detail.hints}>
            {record.hints === undefined ? (
              <span className="text-sm text-ink-600">{copy.myPage.hintsUsed(record.hintsUsed)}</span>
            ) : record.hints.length === 0 ? (
              <span className="text-sm text-ink-600">{detail.noHints}</span>
            ) : (
              <ol className="flex flex-col gap-1">
                {record.hints.map((hint, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bloom-100 text-xs font-bold text-bloom-700">
                      {index + 1}
                    </span>
                    {hint}
                  </li>
                ))}
              </ol>
            )}
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label={detail.time}>
              <span className="text-base">
                {record.durationMs === undefined ? '—' : copy.myPage.seconds(Math.round(record.durationMs / 1000))}
              </span>
            </Row>
            <Row label={detail.mode}>
              <span className="text-base">{copy.answerModes[record.inputMode].label}</span>
            </Row>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-14 w-full rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600"
        >
          {detail.close}
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}
