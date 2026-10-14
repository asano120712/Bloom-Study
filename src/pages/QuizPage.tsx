import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BoxHandwriting } from '@/components/BoxHandwriting'
import { ColumnForm, DivisionForm, type ColumnCell } from '@/components/ColumnForm'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HintList } from '@/components/HintList'
import { NumberInput } from '@/components/NumberInput'
import { PartsInput } from '@/components/PartsInput'
import { Loading } from '@/components/Loading'
import { TypingInput } from '@/components/TypingInput'
import { answerChoicesOf, findGenre } from '@/data/genres'
import { assemblyOf } from '@/features/assemble'
import { answerFromSteps, columnScript, type ColumnStep } from '@/features/math'
import { readCells } from '@/features/recognize'
import { buildHints, hintLayoutOf, revealedHints } from '@/features/hints'
import { judgeHandwriting, judgeNumber, judgeParts, judgeTyping } from '@/features/judge'
import { useCopy } from '@/hooks/useAudienceMode'
import { useHintTimer } from '@/hooks/useHintTimer'
import { useQuizSession } from '@/hooks/useQuizSession'
import { useStats } from '@/hooks/useStats'
import {
  isDifficulty,
  isPromptForm,
  type AnswerRecord,
  type Difficulty,
  type InputMode,
  type JudgeResult,
  type PromptForm,
  type Question,
} from '@/types'
import { shuffleWithSeed } from '@/utils/shuffle'
import type { ResultState, ResultSubmission } from './ResultPage'

/**
 * 自動で「せいかい」にしてよい自信の下限。
 *
 * ここを下回ったら、読み取った数を見せて本人に決めてもらう。
 * 実機で測ったところ、きれいに書けていれば 0.9 を超える。
 */
const READ_CONFIDENCE = 0.9

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

  /**
   * 解く形。筆算で出す問題でも、1行の式で解くことを選べる
   * (`form=plain`)。既定は筆算で、選ばなければ今までどおり。
   */
  const formParam = searchParams.get('form')
  const promptForm: PromptForm = isPromptForm(formParam) ? formParam : 'column'

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
  const [selfReport, setSelfReport] = useState<{
    hintsUsed: number
    image: string
    /** 読み取れた数。読み取りに回さなかった(漢字・英単語の)ときは無い */
    read?: string
  } | null>(null)
  /**
   * 筆算の途中の段(部分積)のうち、打ち終わったもの。
   * 間違えた段は正しい数に直して残す。そのまま進ませると、最後の答えまで必ず合わなくなる。
   *
   * 問題が変わるときは画面ごと作り直される(1問答えるたびに結果画面へ移る)ので、
   * ここで問題の切り替わりを見る必要はない。
   */
  /** 筆算で打ち終わったところ。段・位・商を打った順に持つ(入るのは正しい数だけ) */
  const [filledSteps, setFilledSteps] = useState<string[]>([])
  /** いまの手で間違えて打った数。赤枠で残し、打ち直すまで先へ進めない */
  const [missed, setMissed] = useState<string | null>(null)
  /**
   * 答えになる手を、1回めで間違えたか。記録はこれで決める。
   *
   * かけ算の段やわり算の引く段は**答えではない**ので、ここには入れない。
   * 途中の書き間違いで「ざんねん」にすると、答えが合っているのに間違い扱いになる。
   */
  const [missedAnswer, setMissedAnswer] = useState(false)

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
      promptForm,
      // 自分が書いた・打ったこたえを結果画面で見せる
      submission,
      // この出題セットに次の問題が残っているときだけ「つぎへ」を出す
      hasNext: cursor + 1 < questions.length,
      currentStreak: next.currentStreak,
    }
    navigate('/result', { state })
  }

  /**
   * パスする。
   *
   * 答えを見せてから次の問題へ進むが、**記録には残さない**(正解数にも不正解数にも
   * 入れず、れんぞくも途切れない)。分からない問題で止まったままになるより、
   * 答えを見て次へ行けるほうがよい。ごまかしに使えてしまうが、
   * 自分のために解くアプリなので、それで困るのは自分だけ。
   */
  const pass = () => {
    commitAdvance()

    const state: ResultState = {
      result: { verdict: 'passed', isCorrect: false, answer: question.answer },
      prompt: question.prompt,
      promptReading: question.promptReading,
      genreId: genre.id,
      inputMode,
      difficulty,
      promptForm,
      hasNext: cursor + 1 < questions.length,
      currentStreak: stats.currentStreak,
    }
    navigate('/result', { state })
  }

  const promptCaption = copy.genrePrompt[genre.id]

  /**
   * 筆算の手順。打つのは数字のときだけ(手書きはノートに書くのと同じで、
   * 書いたものを読み取らないため途中を追えない)。
   */
  /** この問題を筆算で出すか。1行の式を選んだときは、答えだけ打つ形にする */
  const layout = promptForm === 'plain' ? undefined : question.promptLayout
  const script = inputMode === 'number' && layout ? columnScript(question.prompt) : []
  const stepIndex = filledSteps.length
  const step = script[stepIndex]
  const isLastStep = stepIndex >= script.length - 1

  /**
   * 1つ打ち終わったとき。
   *
   * **合うまで先へ進まない。** 間違えたまま進むと、そのあとの段も答えも必ず合わなくなり、
   * どこでつまずいたのか分からなくなる。紙の筆算でも、間違えたらそこを消して書き直す。
   *
   * 記録に残すのは**答えの部分を1回めで打てたか**だけ。打ち直せば必ず「できた」に
   * なるのでは記録の意味が無いが、途中の段の書き間違いまで「ざんねん」にすると、
   * 答えが合っているのに間違い扱いになる。
   */
  const commitStep = (value: string, entry: ColumnStep) => {
    if (value !== entry.expected) {
      setMissed(value)
      // 答えになる手(位ごとの数・商・こたえ)を間違えたときだけ、記録に残す
      if (entry.counts) setMissedAnswer(true)
      return
    }
    setMissed(null)
    setFilledSteps((filled) => [...filled, value])
  }

  /** 決定キーの文字は、つぎに何へ進むのかに合わせる(段・くらい・筆算のつづき) */
  const nextStepLabel =
    step?.slot.kind === 'row'
      ? copy.number.nextRow
      : step?.slot.kind === 'place'
        ? copy.number.nextPlace
        : copy.number.nextStep

  /**
   * 筆算のマス。打ち終わったところと、いま打っているところ。
   *
   * 間違えた数は、打ち直しを始めるまで赤枠で残す。消してしまうと、
   * 何を打って間違えたのかが分からないまま打ち直すことになる。
   */
  const columnCells = (typed?: string): ColumnCell[] => {
    const done = script.slice(0, stepIndex).map((entry) => ({
      slot: entry.slot,
      digits: entry.expected,
      tone: 'done' as const,
    }))
    if (typed === undefined || !step) return done

    const isShowingMissed = missed !== null && typed === ''
    return [
      ...done,
      {
        slot: step.slot,
        digits: isShowingMissed ? missed : typed,
        width: step.width,
        tone: isShowingMissed ? ('wrong' as const) : ('typing' as const),
      },
    ]
  }

  /**
   * 手書きで書くマス。
   *
   * **答えのところだけ**(たし算・ひき算は位ごと、わり算は商、かけ算はこたえ)。
   * 部分積や引く段までマスにすると、答えを書く場所が埋もれるうえ、マスが縦に
   * 3段・4段と積もって背の低い端末ではみ出す。途中の計算は紙の余白と同じで、
   * 書く場所をこちらで決めない(読み取るのは答えのマスだけ)。
   *
   * 書いた字は最後にまとめて読み取って判定する(judgeWritten)。
   */
  const answerSteps =
    inputMode === 'handwriting' && layout
      ? columnScript(question.prompt).filter((entry) => entry.counts)
      : []
  /*
    並べる順は**画面と同じ左から右**。たし算・ひき算の位は一のくらいから作られるので
    向きを変える。まとめた画像もこの順で並ぶため、ここでそろえておく。
  */
  const writeScript =
    answerSteps[0]?.slot.kind === 'place' ? [...answerSteps].reverse() : answerSteps
  const writeRows = writeScript.map((entry, index) => ({
    key: `${question.id}-${index}`,
    boxes: entry.width,
    // 答えは横に1行。わり算の商も、位ごとの答えも同じ行に並ぶ
    line: 0,
  }))

  /**
   * 書いた数を読み取って判定する(計算の筆算だけ)。
   *
   * **合っているときだけ自動で決める。** 読み取りは完全ではないので、
   * 違って見えたときに「ちがった」と決めつけると、正しく書けたのに
   * 間違い扱いになる。そのときは読み取った数を見せて、本人に決めてもらう
   * (これまでの自己申告と同じ画面)。
   *
   * 自信(いちばん怪しいマスの値)が足りないときも、同じく本人に預ける。
   */
  const judgeWritten = async (
    image: string,
    rows: { key: string; cells: ImageData[] }[],
  ): Promise<void> => {
    const hintsUsed = revealedCount

    // 答えになる手(位ごとの数・商・こたえ)だけを読む。途中の段は点数に入れない
    const parts = await Promise.all(
      writeScript.map(async (entry, index) =>
        entry.counts ? await readCells(rows[index]?.cells ?? []) : { text: '', confidence: 1 },
      ),
    )
    // マスは画面と同じ左から右に並べ直してあるので、読んだ字をそのままつなげば答えになる。
    // answerFromSteps は打つ順(一のくらいから)を前提に並べ替えるため、ここでは使わない
    const answered = parts.map((part) => part.text).join('')
    const confidence = parts
      .filter((_, index) => writeScript[index].counts)
      .reduce((lowest, part) => Math.min(lowest, part.confidence), 1)

    const judged = judgeNumber(question, answered)
    if (judged.isCorrect && confidence >= READ_CONFIDENCE) {
      finish(judged, hintsUsed, { kind: 'handwriting', imageDataUrl: image })
      return
    }

    setSelfReport({ hintsUsed, image, read: answered })
  }

  /** 計算は「ヒント → 式 → 答え」の順に置く */
  const showsPromptBelow = genre.id === 'math'
  /** 筆算のときは、式と答えのマスをひと続きに見せたいので入力側が出す */
  const showsPromptInInput = showsPromptBelow && layout !== undefined
  /** 手書きも、筆算なら大きなキャンバスではなくマスに1字ずつ書く */
  const writesInBoxes = showsPromptInInput && inputMode === 'handwriting'

  return (
    <AppShell fitViewport exitTo="/genres">
      {/* 出題中に読む場所は選択できなくてよい。手書きのドラッグで範囲選択されるのを防ぐ */}
      <header className="flex items-center justify-between gap-2 text-sm text-ink-600 select-none">
        <span className="min-w-0 truncate">{copy.activities[genre.id].label}</span>

        <span className="flex shrink-0 items-center gap-2">
          <span aria-live="polite">{copy.quiz.progress(stats.currentStreak, cursor + 1)}</span>
          {/*
            パスは進み具合の横。分からないまま止まったときに探す場所は、
            入力の近くではなく「この問題をやめる」ことを考える場所(上)のほう。
            やめるとは反対側に置いて、押し間違えないようにしてある。
          */}
          <button
            type="button"
            onClick={pass}
            aria-label={copy.quiz.passAria}
            className="flex min-h-8 shrink-0 items-center rounded-full border-2 border-bloom-200 px-3 text-xs font-bold text-ink-600"
          >
            {copy.quiz.pass}
          </button>
        </span>
      </header>

      {/*
        計算だけ、出題をヒントの下に置く(ヒント → 式 → 答え)。
        紙の筆算と同じで、式と答えを書く場所が隣り合っていたほうが解きやすい。
        思い出す系のジャンルは、先に出題語を見て考える流れなので上のまま。
      */}
      {!showsPromptBelow && (
        <PromptBlock question={question} layout={layout} caption={promptCaption} />
      )}

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
        <PromptBlock question={question} layout={layout} caption={promptCaption} />
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
          // 読み取れなかった・違って見えたときは、正解を見せて自己申告してもらう
          <div className="flex flex-col gap-4 select-none">
            <div className="rounded-3xl bg-bloom-50 px-5 py-6 text-center">
              <p className="text-sm text-ink-400">{copy.quiz.answerLabel}</p>
              <p className="mt-2 text-3xl font-bold text-bloom-700">{question.answer}</p>
              {/* 何と読めたのかを見せる。書き直すときの手がかりになる */}
              {selfReport.read && (
                <p className="mt-3 text-sm text-ink-600">{copy.quiz.readAs(selfReport.read)}</p>
              )}
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
                // 打ち直しのたびに作り直して、打った数を空に戻す
                key={`number-${question.id}-${stepIndex}-${missed ?? ''}`}
                // 筆算は、そこに入りうる桁数より多くは打てない(マスからはみ出す)
                maxLength={step?.width}
                display={
                  showsPromptInInput
                    ? (typed) => (
                        <PromptBlock
                          question={question}
                          layout={layout}
                          // 打っている場所の名前を出す(「一のくらい」「かける 7 × 8」)
                          caption={step?.caption ?? promptCaption}
                          note={missed === null ? undefined : copy.number.retry}
                          cells={columnCells(typed)}
                        />
                      )
                    : undefined
                }
                submitLabel={isLastStep ? copy.number.submit : nextStepLabel}
                onSubmit={(value) => {
                  if (step && !isLastStep) {
                    commitStep(value, step)
                    return
                  }
                  // 最後の手。ここも合うまで進まない
                  if (step && value !== step.expected) {
                    setMissed(value)
                    if (step.counts) setMissedAnswer(true)
                    return
                  }
                  // 答えは、打った途中のものから組み立てる(位ごと・商は、それ自体が答え)
                  const typed = [...filledSteps, value]
                  const answer = script.length > 0 ? answerFromSteps(script, typed) : value
                  const judged = judgeNumber(question, answer)
                  finish(
                    // 答えの部分を1回めで間違えていたら、打ち直して合っても「ざんねん」
                    missedAnswer ? { ...judged, verdict: 'incorrect', isCorrect: false } : judged,
                    revealedCount,
                    { kind: 'text', text: answer },
                  )
                }}
              />
            )}
            {inputMode === 'handwriting' && writesInBoxes && (
              <BoxHandwriting
                key={`boxes-${question.id}`}
                rows={writeRows}
                // マスは筆算のその場所に置く。式と離すと、どこに書くのか分からなくなる
                form={(cellsOf) => (
                  <PromptBlock
                    question={question}
                    layout={layout}
                    caption={promptCaption}
                    writing
                    cells={writeRows.map((row, index) => ({
                      slot: writeScript[index].slot,
                      digits: '',
                      width: row.boxes,
                      tone: 'typing' as const,
                      content: cellsOf(row.key),
                    }))}
                  />
                )}
                onSubmit={(image, rows) => void judgeWritten(image, rows)}
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
  layout,
  caption,
  cells,
  note,
  writing,
}: {
  question: Question
  /** 筆算で出すか。渡さなければ1行の式のまま出す */
  layout?: 'column' | 'division'
  /** 出題語の上の一言。無いジャンル(計算)もある */
  caption?: string
  /** 打ち直してもらうときの一言。式の上、見出しのすぐ下に出す */
  note?: string
  /** 筆算のマス(打ち終わったところと、いま打っているところ) */
  cells?: ColumnCell[]
  /** 手書きで書くとき。マスが指で書ける大きさになる */
  writing?: boolean
}) {
  return (
    <section className="mt-4 shrink-0 text-center select-none">
      {caption && <p className="text-xs text-ink-400">{caption}</p>}
      {note && (
        <p aria-live="assertive" className="text-xs font-bold text-warm-600">
          {note}
        </p>
      )}
      {/*
        わり算の筆算だけ字を小さくする。商・引く段・ひいた数で6段になり、
        他と同じ大きさだと数字キーボードまで入らない。
      */}
      <p
        className={`mt-1 font-bold tracking-wide ${
          layout === 'division'
            ? 'text-[min(1.5rem,6.5vw)] leading-7'
            : 'text-[min(1.875rem,8vw)] leading-9'
        }`}
      >
        {layout === 'column' ? (
          <ColumnForm expression={question.prompt} cells={cells} writing={writing} />
        ) : layout === 'division' ? (
          <DivisionForm expression={question.prompt} cells={cells} writing={writing} />
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
