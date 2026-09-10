import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Loading } from '@/components/Loading'
import { TRIAL_LIMIT } from '@/config'
import { findQuestion } from '@/data/questions'
import { useCopy } from '@/hooks/useAudienceMode'
import { useStats } from '@/hooks/useStats'

/**
 * 履歴に出す出題語。漢字は熟語を伏せた形(「◯犬」)なので、
 * 読みまで添えないとどの問題だったか分からない。
 */
function promptTextOf(questionId: string): string {
  const question = findQuestion(questionId)
  if (!question) return questionId
  return `${question.prompt}${question.promptReading ?? ''}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-bloom-50 px-3 py-4 text-center">
      {/*
        break-keep: 日本語は既定でどこでも折り返すため、狭いタイルでは
        「いま れんぞ / く」のように語の途中で切れる。空白でだけ折る。
      */}
      <p className="text-xs break-keep text-ink-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-bloom-700">{value}</p>
    </div>
  )
}

export function MyPage() {
  const { stats, isLoading, reset } = useStats()
  const copy = useCopy()

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

      <div className="mt-6 flex gap-3">
        <Stat
          label={copy.myPage.correct}
          value={`${stats.totalCorrect} / ${stats.totalAnswered}`}
        />
        <Stat label={copy.myPage.currentStreak} value={`${stats.currentStreak}`} />
        <Stat label={copy.myPage.bestStreak} value={`${stats.bestStreak}`} />
      </div>

      <p className="mt-4 text-sm text-ink-600">
        {copy.myPage.trialLeft(Math.max(0, TRIAL_LIMIT - stats.trialUsed))}
      </p>

      <h2 className="mt-8 text-lg font-bold">{copy.myPage.history}</h2>
      {stats.history.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">{copy.myPage.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {stats.history.map((record, index) => (
            <li
              key={`${record.questionId}-${record.answeredAt}-${index}`}
              className="flex items-center justify-between rounded-2xl bg-base-100 px-4 py-3 text-sm"
            >
              <span>
                {copy.activities[record.genreId].label} /{' '}
                {promptTextOf(record.questionId)}
              </span>
              <span className={record.isCorrect ? 'text-bloom-700' : 'text-warm-600'}>
                {record.isCorrect ? '⭕️' : '✖️'} {copy.myPage.hintsUsed(record.hintsUsed)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/genres"
          className="flex min-h-14 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
        >
          {copy.myPage.solve}
        </Link>
        <button
          type="button"
          onClick={() => void reset()}
          className="text-sm text-ink-400 underline"
        >
          {copy.myPage.reset}
        </button>
      </div>
    </AppShell>
  )
}
