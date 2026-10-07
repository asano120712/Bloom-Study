import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BoxHandwriting } from '@/components/BoxHandwriting'
import { ColumnForm, DivisionForm, type ColumnRow } from '@/components/ColumnForm'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HintList } from '@/components/HintList'
import { NumberInput } from '@/components/NumberInput'
import { PartsInput } from '@/components/PartsInput'
import { Loading } from '@/components/Loading'
import { TypingInput } from '@/components/TypingInput'
import { answerChoicesOf, findGenre } from '@/data/genres'
import { assemblyOf } from '@/features/assemble'
import { answerBoxCount } from '@/features/math'
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
  type Question,
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
  /**
   * 筆算の途中の段(部分積)のうち、打ち終わったもの。
   * 間違えた段は正しい数に直して残す。そのまま進ませると、最後の答えまで必ず合わなくなる。
   *
   * 問題が変わるときは画面ごと作り直される(1問答えるたびに結果画面へ移る)ので、
   * ここで問題の切り替わりを見る必要はない。
   */
  const [filledRows, setFilledRows] = useState<ColumnRow[]>([])

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

  const promptCaption = copy.genrePrompt[genre.id]

  /** 筆算の途中の段。打つのは数字のときだけ(手書きはノートに書くので要らない) */
  const steps = inputMode === 'number' ? (question.steps ?? []) : []
  const stepIndex = filledRows.length
  const isLastStep = stepIndex >= steps.length

  /**
   * 段を1つ打ち終わったとき。合っていてもいなくても止めずに次の段へ進み、
   * 間違えた段は正しい数に直して残す(直さないと最後の答えまで必ず合わなくなる)。
   */
  const commitStep = (value: string) => {
    const expected = steps[stepIndex]
    setFilledRows((rows) => [
      ...rows,
      { value: expected, shift: rows.length, corrected: value !== expected },
    ])
  }

  /** 計算は「ヒント → 式 → 答え」の順に置く */
  const showsPromptBelow = genre.id === 'math'
  /** 筆算のときは、式と答えのマスをひと続きに見せたいので入力側が出す */
  const showsPromptInInput = showsPromptBelow && question.promptLayout !== undefined
  /** 手書きも、筆算なら大きなキャンバスではなくマスに1字ずつ書く */
  const writesInBoxes = showsPromptInInput && inputMode === 'handwriting'

  return (
    <AppShell fitViewport exitTo="/genres">
      {/* 出題中に読む場所は選択できなくてよい。手書きのドラッグで範囲選択されるのを防ぐ */}
      <header className="flex items-center justify-between text-sm text-ink-600 select-none">
        <span>{copy.activities[genre.id].label}</span>
        <span aria-live="polite">{copy.quiz.progress(stats.currentStreak, cursor + 1)}</span>
      </header>

      {/*
        計算だけ、出題をヒントの下に置く(ヒント → 式 → 答え)。
        紙の筆算と同じで、式と答えを書く場所が隣り合っていたほうが解きやすい。
        思い出す系のジャンルは、先に出題語を見て考える流れなので上のまま。
      */}
      {!showsPromptBelow && <PromptBlock question={question} caption={promptCaption} />}

      {/*
        ヒント枠は余りを分け合うが、上限を決めて残りは入力側(特にキャンバス)へ回す。
        上限が 44(176px)だと、計算の3段のどれかが2行になったとき最後の段が切れる。
        52(208px)なら2行ぶん増えても収まる。
      */}
      <section className="mt-4 flex max-h-52 min-h-0 flex-1 flex-col">
        <HintList
          hints={revealedHints(hints, revealedCount)}
          layout={hintLayoutOf(genre.id)}
          secondsToNext={secondsToNext}
        />
      </section>

      {/* 計算は、ヒントのあとに出題を置く。答えを書く場所のすぐ上になる */}
      {showsPromptBelow && !showsPromptInInput && (
        <PromptBlock question={question} caption={promptCaption} />
      )}

      {/* 余りは入力側へ多めに配る(ヒント枠と 2:1)。キャンバスとキーはここで伸びる */}
      {/*
        マスに書くときは真ん中に寄せる。キーボードと違って縦に短く、
        下に寄せるとヒント枠との間が大きく空いて、つながりが見えなくなる。
      */}
      <section
        className={`mt-auto flex min-h-0 flex-2 flex-col pt-4 ${writesInBoxes ? 'justify-center' : 'justify-end'}`}
      >
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
                key={`number-${question.id}-${stepIndex}`}
                display={
                  showsPromptInInput
                    ? (typed) => (
                        <PromptBlock
                          question={question}
                          caption={promptCaption}
                          typed={typed}
                          rows={filledRows}
                          typedShift={isLastStep ? 0 : stepIndex}
                        />
                      )
                    : undefined
                }
                submitLabel={isLastStep ? copy.number.submit : copy.number.nextRow}
                onSubmit={(value) => {
                  if (!isLastStep) {
                    commitStep(value)
                    return
                  }
                  finish(judgeNumber(question, value), revealedCount, {
                    kind: 'text',
                    text: value,
                  })
                }}
              />
            )}
            {inputMode === 'handwriting' && writesInBoxes && (
              <BoxHandwriting
                key={`boxes-${question.id}`}
                boxes={answerBoxCount(question.prompt)}
                // マスは筆算の線の下に置く。式と離すと、どこに書くのか分からなくなる
                form={(cells) => (
                  <PromptBlock question={question} caption={promptCaption} writeRow={cells} />
                )}
                onSubmit={(image) => setSelfReport({ hintsUsed: revealedCount, image })}
              />
            )}
            {inputMode === 'handwriting' && !writesInBoxes && (
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

/**
 * 出題(見出し + 式)。置き場所がジャンルで変わるので部品にしてある。
 *
 * 筆算で数を打つときは、打った数(typed)も受け取って答えのマスまで出す。
 * 紙の筆算と同じで、式のすぐ下が答えを書く場所になる。
 */
function PromptBlock({
  question,
  caption,
  typed,
  rows,
  typedShift,
  writeRow,
}: {
  question: Question
  caption: string
  typed?: string
  rows?: ColumnRow[]
  typedShift?: number
  /** 手書きで書き込むマス */
  writeRow?: ReactNode
}) {
  return (
    <section className="mt-4 shrink-0 text-center select-none">
      <p className="text-xs text-ink-400">{caption}</p>
      <p className="mt-1 text-[min(1.875rem,8vw)] leading-9 font-bold tracking-wide">
        {question.promptLayout === 'column' ? (
          <ColumnForm
            expression={question.prompt}
            typed={typed}
            rows={rows}
            typedShift={typedShift}
            writeRow={writeRow}
          />
        ) : question.promptLayout === 'division' ? (
          <DivisionForm expression={question.prompt} typed={typed} writeRow={writeRow} />
        ) : (
          question.prompt
        )}
      </p>
      {/* 読みは出題語より小さく。主役はあくまで伏せた語のほう */}
      {question.promptReading && (
        <p className="mt-1 text-base text-ink-600">{question.promptReading}</p>
      )}
    </section>
  )
}
