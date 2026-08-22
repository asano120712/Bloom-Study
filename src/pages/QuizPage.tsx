import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HintList } from '@/components/HintList'
import { Loading } from '@/components/Loading'
import { TypingInput } from '@/components/TypingInput'
import { TRIAL_LIMIT } from '@/config'
import { findGenre } from '@/data/genres'
import { questionsOf } from '@/data/questions'
import { buildHints, revealedHints } from '@/features/hints'
import { judgeHandwriting, judgeTyping } from '@/features/judge'
import { useHintTimer } from '@/hooks/useHintTimer'
import { useStats } from '@/hooks/useStats'
import { readCursor, writeCursor } from '@/services/quizSession'
import type { AnswerRecord, InputMode, JudgeResult } from '@/types'
import type { ResultState } from './ResultPage'

export function QuizPage() {
  const { genreId } = useParams<{ genreId: string }>()
  const navigate = useNavigate()
  const genre = findGenre(genreId ?? '')
  const { stats, isLoading, record } = useStats()

  const questions = useMemo(() => (genre ? questionsOf(genre.id) : []), [genre])
  const cursor = genre ? readCursor(genre.id) : 0
  const question = questions[cursor]

  const [inputMode, setInputMode] = useState<InputMode>(genre?.defaultInputMode ?? 'typing')
  /** 手書きモードで「かけた」を押した後、自己申告を待っている状態 */
  const [selfReport, setSelfReport] = useState<{ hintsUsed: number } | null>(null)

  const hints = useMemo(() => (question ? buildHints(question) : []), [question])
  const { revealedCount, secondsToNext } = useHintTimer({
    totalHints: hints.length,
    paused: selfReport !== null,
  })

  const trialLeft = Math.max(0, TRIAL_LIMIT - stats.trialUsed)

  // 無料トライアルの上限に達していたら出題せず案内画面へ送る
  useEffect(() => {
    if (!isLoading && trialLeft === 0) {
      navigate('/trial-end', { replace: true })
    }
  }, [isLoading, trialLeft, navigate])

  if (!genre) return <Navigate to="/genres" replace />

  if (isLoading || trialLeft === 0) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    )
  }

  // 用意した問題を出し切った場合は、先頭に戻さずジャンル選択へ返す
  if (!question) {
    return <Navigate to="/genres" replace />
  }

  const finish = async (result: JudgeResult, hintsUsed: number) => {
    const answer: AnswerRecord = {
      questionId: question.id,
      genreId: genre.id,
      inputMode,
      verdict: result.verdict,
      isCorrect: result.isCorrect,
      hintsUsed,
      answeredAt: new Date().toISOString(),
    }
    const next = await record(answer)
    writeCursor(genre.id, cursor + 1)

    const state: ResultState = {
      result,
      prompt: question.prompt,
      genreId: genre.id,
      // 次の問題があり、かつトライアル残があるときだけ「つぎへ」を出す
      hasNext: cursor + 1 < questions.length && next.trialUsed < TRIAL_LIMIT,
      currentStreak: next.currentStreak,
    }
    navigate('/result', { state })
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between text-sm text-ink-600">
        <span>{genre.label}</span>
        <span aria-live="polite">
          🌱 {stats.currentStreak} れんぞく / のこり {trialLeft} 問
        </span>
      </header>

      <section className="mt-8 text-center">
        <p className="text-xs text-ink-400">この言葉を思い出そう</p>
        <p className="mt-2 text-4xl font-bold tracking-wide">{question.prompt}</p>
      </section>

      <section className="mt-8">
        <HintList hints={revealedHints(hints, revealedCount)} secondsToNext={secondsToNext} />
      </section>

      <section className="mt-auto pt-8">
        {selfReport ? (
          // 手書きは自動判定しない。正解を提示したうえで自己申告してもらう
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-bloom-50 px-5 py-6 text-center">
              <p className="text-sm text-ink-400">こたえ</p>
              <p className="mt-2 text-3xl font-bold text-bloom-700">{question.answer}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => finish(judgeHandwriting(question, false), selfReport.hintsUsed)}
                className="min-h-14 flex-1 rounded-full border-2 border-warm-500 text-lg font-bold text-warm-600"
              >
                ✖️ ちがった
              </button>
              <button
                type="button"
                onClick={() => finish(judgeHandwriting(question, true), selfReport.hintsUsed)}
                className="min-h-14 flex-1 rounded-full bg-bloom-700 text-lg font-bold text-white"
              >
                ⭕️ できた
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              role="group"
              aria-label="入力モード切替"
              className="mb-4 flex rounded-full bg-bloom-100 p-1"
            >
              {(['typing', 'handwriting'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={inputMode === mode}
                  // 切替時は入力コンポーネントごと差し替わり、入力内容はリセットされる
                  onClick={() => setInputMode(mode)}
                  className={`min-h-12 flex-1 rounded-full text-base font-bold ${
                    inputMode === mode ? 'bg-white text-bloom-700' : 'text-ink-600'
                  }`}
                >
                  {mode === 'typing' ? 'タイピング' : '手書き'}
                </button>
              ))}
            </div>

            {inputMode === 'typing' ? (
              <TypingInput
                key={`typing-${question.id}`}
                onSubmit={(value) => finish(judgeTyping(question, value), revealedCount)}
              />
            ) : (
              <HandwritingCanvas
                key={`handwriting-${question.id}`}
                onSubmit={() => setSelfReport({ hintsUsed: revealedCount })}
              />
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
