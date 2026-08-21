import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { TRIAL_LIMIT } from '@/config'
import { findGenre } from '@/data/genres'
import { findQuestion } from '@/data/questions'
import { useStats } from '@/hooks/useStats'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-bloom-50 px-3 py-4 text-center">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-bloom-700">{value}</p>
    </div>
  )
}

export function MyPage() {
  const { stats, isLoading, reset } = useStats()

  if (isLoading) {
    return (
      <AppShell>
        <p className="m-auto text-ink-400">よみこみ中…</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">これまでの記録</h1>

      <div className="mt-6 flex gap-3">
        <Stat label="正解数" value={`${stats.totalCorrect} / ${stats.totalAnswered}`} />
        <Stat label="いま連続" value={`${stats.currentStreak}`} />
        <Stat label="最高連続" value={`${stats.bestStreak}`} />
      </div>

      <p className="mt-4 text-sm text-ink-600">
        無料でとける残り: {Math.max(0, TRIAL_LIMIT - stats.trialUsed)} 問
      </p>

      <h2 className="mt-8 text-lg font-bold">解答履歴</h2>
      {stats.history.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">まだ記録がありません。</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {stats.history.map((record, index) => (
            <li
              key={`${record.questionId}-${record.answeredAt}-${index}`}
              className="flex items-center justify-between rounded-2xl bg-base-100 px-4 py-3 text-sm"
            >
              <span>
                {findGenre(record.genreId)?.label} /{' '}
                {findQuestion(record.questionId)?.prompt ?? record.questionId}
              </span>
              <span className={record.isCorrect ? 'text-bloom-700' : 'text-warm-600'}>
                {record.isCorrect ? '⭕️' : '✖️'} ヒント{record.hintsUsed}
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
          問題をとく
        </Link>
        <button
          type="button"
          onClick={() => void reset()}
          className="text-sm text-ink-400 underline"
        >
          記録をリセットする(開発用)
        </button>
      </div>
    </AppShell>
  )
}
