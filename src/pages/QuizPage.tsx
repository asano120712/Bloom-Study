import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HintList } from '@/components/HintList'
import { PartsInput } from '@/components/PartsInput'
import { Loading } from '@/components/Loading'
import { TypingInput } from '@/components/TypingInput'
import { findGenre } from '@/data/genres'
import { buildHints, hintLayoutOf, revealedHints } from '@/features/hints'
import { judgeHandwriting, judgeParts, judgeTyping } from '@/features/judge'
import { useHintTimer } from '@/hooks/useHintTimer'
import { useQuizSession } from '@/hooks/useQuizSession'
import { useStats } from '@/hooks/useStats'
import type { AnswerRecord, InputMode, JudgeResult } from '@/types'
import { shuffleWithSeed } from '@/utils/shuffle'
import type { ResultState } from './ResultPage'

export function QuizPage() {
  const { genreId } = useParams<{ genreId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const genre = findGenre(genreId ?? '')
  const { stats, isLoading: isStatsLoading, record } = useStats()

  /**
   * 入力方法はジャンル選択のシートで決めて URL で受け取る。
   * 直接 URL を叩かれた場合だけジャンルの既定にフォールバックする。
   */
  const modeParam = searchParams.get('mode')
  const inputMode: InputMode =
    modeParam === 'typing' || modeParam === 'handwriting' || modeParam === 'assemble'
      ? modeParam
      : (genre?.defaultInputMode ?? 'typing')

  // 出せる問題は入力方法で変わる(assemble は部品のタイルを持つ問題だけ)
  const { questions, cursor, isLoading: isSessionLoading, commitAdvance } = useQuizSession(
    genre?.id,
    inputMode,
  )
  const question = questions[cursor]
  /** 手書きモードで「かけた」を押した後、自己申告を待っている状態 */
  const [selfReport, setSelfReport] = useState<{ hintsUsed: number } | null>(null)

  const hints = useMemo(() => (question ? buildHints(question) : []), [question])

  /**
   * assemble モードの部品タイル。並びは問題IDから決まるので、再描画しても動かない
   * (押そうとした瞬間に位置が入れ替わるのを避ける)。
   */
  const partTiles = useMemo(
    () => (question?.partTiles?.length ? shuffleWithSeed(question.partTiles, question.id) : []),
    [question],
  )

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
      inputMode,
      // この出題セットに次の問題が残っているときだけ「つぎへ」を出す
      hasNext: cursor + 1 < questions.length,
      currentStreak: next.currentStreak,
    }
    navigate('/result', { state })
  }

  return (
    <AppShell fitViewport>
      <header className="flex items-center justify-between text-sm text-ink-600">
        <span>{genre.label}</span>
        <span aria-live="polite">
          🌱 {stats.currentStreak} れんぞく / {cursor + 1} 問め
        </span>
      </header>

      <section className="mt-4 shrink-0 text-center">
        <p className="text-xs text-ink-400">この言葉を思い出そう</p>
        <p className="mt-1 text-3xl font-bold tracking-wide">{question.prompt}</p>
      </section>

      {/* ヒント枠は余りを分け合うが、上限を決めて残りは入力側(特にキャンバス)へ回す */}
      <section className="mt-4 flex max-h-44 min-h-0 flex-1 flex-col">
        <HintList
          hints={revealedHints(hints, revealedCount)}
          layout={hintLayoutOf(genre.id)}
          secondsToNext={secondsToNext}
        />
      </section>

      {/* 余りは入力側へ多めに配る(ヒント枠と 2:1)。キャンバスとキーはここで伸びる */}
      <section className="mt-auto flex min-h-0 flex-2 flex-col justify-end pt-4">
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
            {inputMode === 'typing' && (
              <TypingInput
                key={`typing-${question.id}`}
                onSubmit={(value) => finish(judgeTyping(question, value), revealedCount)}
              />
            )}
            {inputMode === 'handwriting' && (
              <HandwritingCanvas
                key={`handwriting-${question.id}`}
                onSubmit={() => setSelfReport({ hintsUsed: revealedCount })}
              />
            )}
            {inputMode === 'assemble' && (
              <PartsInput
                key={`assemble-${question.id}`}
                tiles={partTiles}
                requiredCount={question.parts?.length ?? 0}
                onSubmit={(selected) => finish(judgeParts(question, selected), revealedCount)}
              />
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
