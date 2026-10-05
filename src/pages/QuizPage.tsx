import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HintList } from '@/components/HintList'
import { NumberInput } from '@/components/NumberInput'
import { PartsInput } from '@/components/PartsInput'
import { Loading } from '@/components/Loading'
import { TypingInput } from '@/components/TypingInput'
import { answerChoicesOf, findGenre } from '@/data/genres'
import { assemblyOf } from '@/features/assemble'
import { buildHints, hintLayoutOf, revealedHints } from '@/features/hints'
import { judgeHandwriting, judgeNumber, judgeParts, judgeTyping } from '@/features/judge'
import { useCopy } from '@/hooks/useAudienceMode'
import { useHintTimer } from '@/hooks/useHintTimer'
import { useQuizSession } from '@/hooks/useQuizSession'
import { useStats } from '@/hooks/useStats'
import {
  isDifficulty,
  type AnswerRecord,
  type Difficulty,
  type InputMode,
  type JudgeResult,
} from '@/types'
import { shuffleWithSeed } from '@/utils/shuffle'
import type { ResultState, ResultSubmission } from './ResultPage'

export function QuizPage() {
  const { genreId } = useParams<{ genreId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const genre = findGenre(genreId ?? '')
  const { stats, isLoading: isStatsLoading, record } = useStats()
  const copy = useCopy()

  /**
   * こたえかたと なんいど はジャンル選択のシートで決めて URL で受け取る。
   * 直接 URL を叩かれた場合は、そのジャンルで最初に勧めるものに寄せる。
   */
  const levelParam = searchParams.get('level')
  const difficulty: Difficulty = isDifficulty(levelParam) ? levelParam : 'junior'

  const modeParam = searchParams.get('mode')
  const inputMode: InputMode =
    modeParam === 'typing' || modeParam === 'handwriting' || modeParam === 'assemble'
      ? modeParam
      : (genre && answerChoicesOf(genre.id, difficulty)[0]?.inputMode) || 'handwriting'

  // 出せる問題は入力方法と難易度で変わる(assemble は部品のタイルを持つ問題だけ)
  const { questions, cursor, isLoading: isSessionLoading, commitAdvance } = useQuizSession(
    genre?.id,
    inputMode,
    difficulty,
  )
  const question = questions[cursor]
  /**
   * 手書きモードで「かけた」を押した後、自己申告を待っている状態。
   * 書いた字は結果画面で見せるため、キャンバスの画像も一緒に抱えておく。
   */
  const [selfReport, setSelfReport] = useState<{ hintsUsed: number; image: string } | null>(null)

  const hints = useMemo(() => (question ? buildHints(question) : []), [question])

  /**
   * assemble モードの部品タイル。並びは問題IDから決まるので、再描画しても動かない
   * (押そうとした瞬間に位置が入れ替わるのを避ける)。
   */
  const partTiles = useMemo(
    () => (question?.partTiles?.length ? shuffleWithSeed(question.partTiles, question.id) : []),
    [question],
  )

  /** マスを左右に割るか上下に割るか。正解の部品そのものは画面へ渡さない */
  const assembleLayout = useMemo(
    () => (question ? (assemblyOf(question)?.layout ?? null) : null),
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

  const finish = async (
    result: JudgeResult,
    hintsUsed: number,
    submission: ResultSubmission,
  ) => {
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
      promptReading: question.promptReading,
      genreId: genre.id,
      inputMode,
      difficulty,
      // 自分が書いた・打ったこたえを結果画面で見せる
      submission,
      // この出題セットに次の問題が残っているときだけ「つぎへ」を出す
      hasNext: cursor + 1 < questions.length,
      currentStreak: next.currentStreak,
    }
    navigate('/result', { state })
  }

  return (
    <AppShell fitViewport exitTo="/genres">
      {/* 出題中に読む場所は選択できなくてよい。手書きのドラッグで範囲選択されるのを防ぐ */}
      <header className="flex items-center justify-between text-sm text-ink-600 select-none">
        <span>{copy.activities[genre.id].label}</span>
        <span aria-live="polite">{copy.quiz.progress(stats.currentStreak, cursor + 1)}</span>
      </header>

      <section className="mt-4 shrink-0 text-center select-none">
        <p className="text-xs text-ink-400">{copy.genrePrompt[genre.id]}</p>
        <p className="mt-1 text-3xl font-bold tracking-wide">{question.prompt}</p>
        {/* 読みは出題語より小さく。主役はあくまで伏せた語のほう */}
        {question.promptReading && (
          <p className="mt-1 text-base text-ink-600">{question.promptReading}</p>
        )}
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
          <div className="flex flex-col gap-4 select-none">
            <div className="rounded-3xl bg-bloom-50 px-5 py-6 text-center">
              <p className="text-sm text-ink-400">{copy.quiz.answerLabel}</p>
              <p className="mt-2 text-3xl font-bold text-bloom-700">{question.answer}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  finish(judgeHandwriting(question, false), selfReport.hintsUsed, {
                    kind: 'handwriting',
                    imageDataUrl: selfReport.image,
                  })
                }
                className="min-h-14 flex-1 rounded-full border-2 border-warm-500 text-lg font-bold text-warm-600"
              >
                {copy.quiz.wrong}
              </button>
              <button
                type="button"
                onClick={() =>
                  finish(judgeHandwriting(question, true), selfReport.hintsUsed, {
                    kind: 'handwriting',
                    imageDataUrl: selfReport.image,
                  })
                }
                className="min-h-14 flex-1 rounded-full bg-bloom-700 text-lg font-bold text-white"
              >
                {copy.quiz.right}
              </button>
            </div>
          </div>
        ) : (
          <>
            {inputMode === 'typing' && (
              <TypingInput
                key={`typing-${question.id}`}
                onSubmit={(value) =>
                  finish(judgeTyping(question, value), revealedCount, {
                    kind: 'text',
                    text: value,
                  })
                }
              />
            )}
            {inputMode === 'number' && (
              <NumberInput
                key={`number-${question.id}`}
                onSubmit={(value) =>
                  finish(judgeNumber(question, value), revealedCount, {
                    kind: 'text',
                    text: value,
                  })
                }
              />
            )}
            {inputMode === 'handwriting' && (
              <HandwritingCanvas
                key={`handwriting-${question.id}`}
                onSubmit={(image) => setSelfReport({ hintsUsed: revealedCount, image })}
              />
            )}
            {inputMode === 'assemble' && assembleLayout && (
              <PartsInput
                key={`assemble-${question.id}`}
                tiles={partTiles}
                layout={assembleLayout}
                // 組み上がるかどうかだけを渡す。正解の部品は画面に持たせない
                assembledOf={(first, second) =>
                  judgeParts(question, first, second).isCorrect ? question.answer : null
                }
                onSubmit={(first, second) =>
                  finish(judgeParts(question, first, second), revealedCount, {
                    kind: 'parts',
                    parts: [first, second],
                  })
                }
              />
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
