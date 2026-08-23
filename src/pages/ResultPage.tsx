import { Link, Navigate, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'
import type { GenreId, InputMode, JudgeResult } from '@/types'

export interface ResultState {
  result: JudgeResult
  prompt: string
  genreId: GenreId
  /** 「つぎの問題へ」で同じこたえかたを引き継ぐ */
  inputMode: InputMode
  hasNext: boolean
  currentStreak: number
}

/** 色だけに頼らず、アイコン+テキストでも正誤が分かるようにする */
const VERDICT_LABEL: Record<JudgeResult['verdict'], string> = {
  correct: '⭕️ せいかい',
  near: '⭕️ おしい! せいかいあつかい',
  incorrect: '✖️ ざんねん',
  'self-correct': '⭕️ できた',
  'self-incorrect': '✖️ ちがった',
}

export function ResultPage() {
  const { state } = useLocation() as { state: ResultState | null }
  if (!state) return <Navigate to="/genres" replace />

  const { result, prompt, genreId, inputMode, hasNext, currentStreak } = state

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {result.isCorrect && <BloomMark size={100} />}

        <p
          className={`text-2xl font-bold ${
            result.isCorrect ? 'text-bloom-700' : 'text-warm-600'
          }`}
        >
          {VERDICT_LABEL[result.verdict]}
        </p>

        <div className="w-full rounded-3xl bg-bloom-50 px-5 py-6">
          <p className="text-sm text-ink-400">{prompt}</p>
          <p className="mt-2 text-3xl font-bold text-bloom-700">{result.answer}</p>
        </div>

        <p className="text-sm text-ink-600">🌱 {currentStreak} 問れんぞく正解中</p>

        <div className="flex w-full flex-col gap-3">
          {hasNext ? (
            <Link
              to={`/quiz/${genreId}?mode=${inputMode}`}
              className="flex min-h-14 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
            >
              つぎの問題へ
            </Link>
          ) : (
            <Link
              to="/genres"
              className="flex min-h-14 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
            >
              ジャンルをえらぶ
            </Link>
          )}
          <Link to="/mypage" className="text-sm text-ink-400 underline">
            記録を見る
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
