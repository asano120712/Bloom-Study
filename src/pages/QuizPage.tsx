import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HintList } from '@/components/HintList'
import { Loading } from '@/components/Loading'
import { TypingInput } from '@/components/TypingInput'
import { findGenre } from '@/data/genres'
import { buildHints, revealedHints } from '@/features/hints'
import { judgeHandwriting, judgeTyping } from '@/features/judge'
import { useHintTimer } from '@/hooks/useHintTimer'
import { useQuizSession } from '@/hooks/useQuizSession'
import { useStats } from '@/hooks/useStats'
import type { AnswerRecord, InputMode, JudgeResult } from '@/types'
import type { ResultState } from './ResultPage'

export function QuizPage() {
  const { genreId } = useParams<{ genreId: string }>()
  const navigate = useNavigate()
  const genre = findGenre(genreId ?? '')
  const { stats, isLoading: isStatsLoading, record } = useStats()

  // 何問配られるかは quizSource が決める。画面はこれがすべてだとして扱う
  const { questions, cursor, isLoading: isSessionLoading, commitAdvance } = useQuizSession(genre?.id)
  const question = questions[cursor]

  const [inputMode, setInputMode] = useState<InputMode>(genre?.defaultInputMode ?? 'typing')
  /** 手書きモードで「かけた」を押した後、自己申告を待っている状態 */
  const [selfReport, setSelfReport] = useState<{ hintsUsed: number } | null>(null)

  const hints = useMemo(() => (question ? buildHints(question) : []), [question])
  const { revealedCount, secondsToNext } = useHintTimer({
    totalHints: hints.length,
    paused: selfReport !== null,
  })

  const isPreparing = isStatsLoading || isSessionLoading

  // 出題セットが空 = もう出せる問題が無い。
  // いまは回数制限が無いので実質到達しないが、出題数に上限を入れたときの行き先。
  useEffect(() => {
    if (!isPreparing && questions.length === 0) {
      navigate('/trial-end', { replace: true })
    }
  }, [isPreparing, questions.length, navigate])

  if (!genre) return <Navigate to="/genres" replace />

  if (isPreparing || questions.length === 0) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    )
  }

  // 出題セットを出し切った場合は、先頭に戻さずジャンル選択へ返す
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
    commitAdvance()

    const state: ResultState = {
      result,
      prompt: question.prompt,
      genreId: genre.id,
      // この出題セットに次の問題が残っているときだけ「つぎへ」を出す
      hasNext: cursor + 1 < questions.length,
      currentStreak: next.currentStreak,
    }
    navigate('/result', { state })
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between text-sm text-ink-600">
        <span>{genre.label}</span>
        <span aria-live="polite">
          🌱 {stats.currentStreak} れんぞく / {cursor + 1} 問め
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
