import { useCallback, useEffect, useRef } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'
import { MathText } from '@/components/MathText'
import { ModelAnswer } from '@/components/ModelAnswer'
import { findGenre } from '@/data/genres'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { useHasFinePointer } from '@/hooks/useHasFinePointer'
import { canSpeak, speak } from '@/services/speech'
import type { Difficulty, GenreId, InputMode, JudgeResult, MathTopic, PromptForm } from '@/types'
import { quizPathOf } from '@/utils/quizPath'

/** 結果画面で見せる「自分のこたえ」。入力方法によって形が違う */
export type ResultSubmission =
  | { kind: 'text'; text: string }
  | { kind: 'parts'; parts: string[] }
  | { kind: 'handwriting'; imageDataUrl: string }

export interface ResultState {
  result: JudgeResult
  prompt: string
  /** 出題語の読み(漢字ジャンルの熟語など、読みが無いと語が決まらないもの) */
  promptReading?: string
  /** 解き方の途中式(分数の計算だけ)。おてほんの下に、答えまでの道すじとして見せる */
  work?: string
  /** おてほんに出す答え(文章題は単位つき)。無ければ判定の答えのまま */
  answerText?: string
  genreId: GenreId
  /** 「つぎの問題へ」で同じこたえかたを引き継ぐ */
  inputMode: InputMode
  /** 「つぎの問題へ」で同じ難易度を引き継ぐ */
  difficulty: Difficulty
  /** 「つぎの問題へ」で同じ解く形(筆算 / 1行の式)を引き継ぐ */
  promptForm?: PromptForm
  /** 「つぎの問題へ」で同じ計算の種類を引き継ぐ。無ければランダム */
  topic?: MathTopic
  /** 自分が書いた・打ったこたえ。パスしたときは無い */
  submission?: ResultSubmission
  hasNext: boolean
  currentStreak: number
}

export function ResultPage() {
  const { state } = useLocation() as { state: ResultState | null }
  const navigate = useNavigate()
  const copy = useCopy()
  const hasFinePointer = useHasFinePointer()
  // 花マークはこども向けのときだけ顔つきにする(おとな向けは今までどおり花びらだけ)
  const isKids = useAudienceMode() === 'kids'

  const genre = state ? findGenre(state.genreId) : undefined
  const speechLang = genre?.speechLang
  const answer = state?.result.answer
  const nextPath = state
    ? state.hasNext
      ? quizPathOf(state.genreId, {
          inputMode: state.inputMode,
          difficulty: state.difficulty,
          form: state.promptForm,
          topic: state.topic,
        })
      : '/genres'
    : '/genres'

  const readAloud = useCallback(() => {
    if (answer && speechLang) speak(answer, speechLang)
  }, [answer, speechLang])

  /** 自動読み上げを済ませた答え。同じ答えで二度鳴らさないための目印 */
  const autoReadFor = useRef<string | null>(null)

  // 答えが出た時点で一度だけ読み上げる。
  // StrictMode では effect が2回走るため、ref で二度目を抑える
  // (ref はマウントし直しでも保たれるので、開発時だけ二重再生になるのを防げる)。
  // iOS はユーザー操作なしの発話を弾くことがあるため、ボタンも併せて置く。
  useEffect(() => {
    if (!answer || !speechLang || autoReadFor.current === answer) return
    autoReadFor.current = answer
    readAloud()
  }, [answer, speechLang, readAloud])

  // PC では Enter でも次へ進めるようにする(押しっぱなしの連射では進めない)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat) return
      event.preventDefault()
      navigate(nextPath)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, nextPath])

  if (!state) return <Navigate to="/genres" replace />

  const { result, prompt, promptReading, work, answerText, submission, hasNext, currentStreak } = state
  const canReadAloud = Boolean(speechLang) && canSpeak()

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {result.isCorrect && <BloomMark size={100} face={isKids ? 'joy' : undefined} />}

        {/* パスは正解でも不正解でもないので、赤くも緑にもしない */}
        <p
          className={`text-2xl font-bold ${
            result.verdict === 'passed'
              ? 'text-ink-600'
              : result.isCorrect
                ? 'text-bloom-700'
                : 'text-warm-600'
          }`}
        >
          {copy.verdicts[result.verdict]}
        </p>

        <div className="w-full rounded-3xl bg-bloom-50 px-5 py-6">
          {/* 出題が無いのは、お手本の字を見せる問題(小1・小2の組み立て)。お手本と同じ字なので出さない */}
          {prompt && (
            <p className="mb-4 text-sm text-ink-400">
              {/* 分数の式は、分子を上・分母を下に積んで見せる */}
              <MathText text={prompt} />
              {promptReading && <span className="ml-1">{promptReading}</span>}
            </p>
          )}

          <div>
            <ModelAnswer answer={answerText ?? result.answer} guide={genre?.answerGuide ?? 'baseline'} />
          </div>

          {/*
            分数は、答えだけでなく途中式も見せる。通分やひっくり返す手順のどこで
            つまずいたかは、答えだけ見比べても分からない。
            式が長いので、記号の前後で折り返してよい。
          */}
          {work && (
            <div className="mt-4">
              <p className="text-sm text-ink-400">{copy.result.work}</p>
              <p className="mt-2 text-xl leading-loose font-bold text-ink-900 tabular-nums">
                <MathText text={work} />
              </p>
            </div>
          )}

          {canReadAloud && (
            <button
              type="button"
              onClick={readAloud}
              aria-label={`${result.answer} の読み方を聞く`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-bloom-200 px-5 text-base font-bold text-bloom-700"
            >
              {copy.result.listen}
            </button>
          )}
        </div>

        {submission && <SubmissionView submission={submission} labels={copy.result.mine} />}

        <p className="text-sm text-ink-600">{copy.result.streak(currentStreak)}</p>

        <div className="flex w-full flex-col gap-3">
          {hasNext ? (
            <Link
              to={nextPath}
              className="flex min-h-14 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
            >
              {copy.result.next}
            </Link>
          ) : (
            <Link
              to={nextPath}
              className="flex min-h-14 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
            >
              {copy.result.chooseGenre}
            </Link>
          )}
          {hasFinePointer && (
            <p className="text-center text-xs text-ink-400">{copy.result.enterHint}</p>
          )}
          <Link to="/mypage" className="flex min-h-14 items-center justify-center rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600">
            {copy.result.record}
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

/** 自分が書いた・打った・組んだこたえを見せる。入力方法ごとに見せ方を変える */
function SubmissionView({
  submission,
  labels,
}: {
  submission: ResultSubmission
  labels: { text: string; parts: string; handwriting: string }
}) {
  if (submission.kind === 'handwriting') {
    return (
      <div className="w-full">
        <p className="text-sm text-ink-400">{labels.handwriting}</p>
        <img
          src={submission.imageDataUrl}
          alt="自分が書いたこたえ"
          className="mx-auto mt-2 w-full max-w-xs rounded-2xl border-2 border-bloom-200 bg-white"
        />
      </div>
    )
  }

  if (submission.kind === 'parts') {
    return (
      <div className="w-full">
        <p className="text-sm text-ink-400">{labels.parts}</p>
        <p className="mt-2 text-2xl font-bold text-ink-900">
          {submission.parts.length ? submission.parts.join(' ＋ ') : '—'}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="text-sm text-ink-400">{labels.text}</p>
      <p className="mt-2 text-2xl font-bold tracking-wide text-ink-900">
        {submission.text ? <MathText text={submission.text} /> : '—'}
      </p>
    </div>
  )
}
