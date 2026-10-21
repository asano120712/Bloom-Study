import { useEffect, useRef, useState } from 'react'
import {
  answerChoicesOf,
  difficultiesOf,
  hasColumnForm,
  mathTopicExample,
  mathTopicsOf,
  type AnswerChoice,
} from '@/data/genres'
import { useCopy } from '@/hooks/useAudienceMode'
import { MathText } from './MathText'
import type { Difficulty, Genre, MathTopic, PromptForm } from '@/types'

interface InputModeSheetProps {
  genre: Genre
  /**
   * なんいどとこたえかた(と、計算なら種類、筆算で出す学年なら解く形)が決まったとき。
   * 種類が undefined なのはランダム(種類で絞らない)。
   * 行き先の出し分けは呼び出し側が決める。
   */
  onStart: (
    difficulty: Difficulty,
    choice: AnswerChoice,
    form?: PromptForm,
    topic?: MathTopic,
  ) => void
  onClose: () => void
}

/**
 * ジャンルを選んだあと、出題を始める前の設定シート。
 *
 * なんいど → こたえかた の2ステップで選ぶ。計算だけは、そのあとに
 * 計算の種類(ランダムも選べる)と、筆算で出す学年なら解く形が続く。
 * **なんいどが先**なのは、選べるこたえかたが なんいど で変わるため。
 * 小1・小2の漢字は熟語の穴うめが成立しないので、この学年だけ
 * こたえかたが「なぞりがき」「くみたて」に差し替わる。
 */
export function InputModeSheet({ genre, onStart, onClose }: InputModeSheetProps) {
  const copy = useCopy()
  const genreWords = copy.activities[genre.id]
  const dialogRef = useRef<HTMLDivElement>(null)
  /**
   * 'difficulty' = なんいど選択、'answer' = こたえかた選択、
   * 'topic' = 計算の種類、'form' = 筆算か1行か
   */
  const [step, setStep] = useState<'difficulty' | 'answer' | 'topic' | 'form'>('difficulty')
  /** なんいどステップで選んだ難易度。こたえかた確定時に一緒に渡す */
  const [selected, setSelected] = useState<Difficulty | null>(null)
  /** こたえかたステップで選んだもの。解く形を選んでから始める */
  const [mode, setMode] = useState<AnswerChoice | null>(null)
  /** 計算の種類。undefined はランダム */
  const [topic, setTopic] = useState<MathTopic | undefined>(undefined)

  const topics = selected ? mathTopicsOf(genre.id, selected) : []
  /** 解く形から戻る先。種類を選ぶ段があればそこへ */
  const beforeForm = topics.length > 1 ? 'topic' : 'answer'

  const backToDifficulty = () => {
    setStep('difficulty')
    setSelected(null)
    setMode(null)
  }

  // 開いた直後にシート内へフォーカスを移し、Esc で1つ前(こたえかた→なんいど、
  // なんいど→閉じる)へ戻れるようにする
  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (step === 'form') setStep(beforeForm)
      else if (step === 'topic') setStep('answer')
      else if (step === 'answer') backToDifficulty()
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, beforeForm, onClose])

  const chooseDifficulty = (difficulty: Difficulty) => {
    setSelected(difficulty)
    setStep('answer')
  }

  /**
   * こたえかたを選んだあと。
   *
   * 計算は、種類を選んでから始める。苦手な計算だけを続けて練習できるようにするため。
   * 筆算で出す学年(計算の小3・4以上)だけ、さらに解く形を選ぶ。
   * 筆算で出す問題が無い学年で聞くと、選んでも何も変わらない。
   */
  const chooseMode = (choice: AnswerChoice) => {
    if (!selected) return
    if (choice.path) {
      onStart(selected, choice)
      return
    }
    setMode(choice)
    if (topics.length > 1) setStep('topic')
    else chooseTopic(choice, undefined)
  }

  /** 計算の種類を選んだあと。undefined はランダム */
  const chooseTopic = (choice: AnswerChoice, chosen: MathTopic | undefined) => {
    if (!selected) return
    setTopic(chosen)
    if (hasColumnForm(genre.id, selected, chosen)) setStep('form')
    else onStart(selected, choice, undefined, chosen)
  }

  const choices = selected ? answerChoicesOf(genre.id, selected) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 py-6">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${genreWords.label}のはじめかた`}
        tabIndex={-1}
        className="animate-bloom-in relative w-full max-w-md rounded-3xl bg-base-50 px-5 pt-6 pb-6 outline-none"
      >
        <p className="text-center text-sm text-ink-400">{genreWords.label}</p>

        {step === 'form' ? (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">{copy.sheet.chooseForm}</h2>

            <div className="mt-6 flex flex-col gap-3">
              {(['column', 'plain'] as const).map((form, index) => (
                <button
                  key={form}
                  type="button"
                  onClick={() => selected && mode && onStart(selected, mode, form, topic)}
                  className={`flex min-h-16 flex-col justify-center rounded-2xl px-5 text-left ${
                    // 筆算を先に勧める。小3・4で習う形で、手順の練習になる
                    index === 0 ? 'bg-bloom-700 text-white' : 'border-2 border-bloom-200 text-ink-900'
                  }`}
                >
                  <span className="text-lg font-bold">{copy.sheet.forms[form].label}</span>
                  <span className={`text-sm ${index === 0 ? 'text-bloom-100' : 'text-ink-600'}`}>
                    {copy.sheet.forms[form].note}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(beforeForm)}
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
            >
              {beforeForm === 'topic' ? copy.sheet.backToTopic : copy.sheet.backToMode}
            </button>
          </>
        ) : step === 'topic' ? (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">{copy.sheet.chooseTopic}</h2>

            {/*
              種類はどれも同じ重みで並べる(こたえかたと違って、勧める順が無い)。
              ランダムは最後。種類を決めずに始めたい人が、迷わず下まで来られるように。
              小3・4は5つ並ぶので、はみ出す端末では中でスクロールさせる。
            */}
            <div className="mt-6 flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain">
              {topics.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => mode && chooseTopic(mode, entry)}
                  className="flex min-h-16 shrink-0 flex-col justify-center rounded-2xl border-2 border-bloom-200 px-5 text-left text-ink-900"
                >
                  <span className="text-lg font-bold">{copy.sheet.topics[entry]}</span>
                  {selected && (
                    <span className="text-sm text-ink-600 tabular-nums">
                      <MathText text={copy.sheet.topicExample(mathTopicExample(selected, entry))} />
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => mode && chooseTopic(mode, undefined)}
                className="flex min-h-16 shrink-0 flex-col justify-center rounded-2xl border-2 border-dashed border-bloom-300 px-5 text-left text-ink-900"
              >
                <span className="text-lg font-bold">{copy.sheet.mixedTopic.label}</span>
                <span className="text-sm text-ink-600">{copy.sheet.mixedTopic.note}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStep('answer')}
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
            >
              {copy.sheet.backToMode}
            </button>
          </>
        ) : step === 'difficulty' ? (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">{copy.sheet.chooseDifficulty}</h2>

            {/* 6段階まで並ぶので、はみ出す端末では中でスクロールさせる */}
            <div className="mt-6 flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain">
              {difficultiesOf(genre.id).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => chooseDifficulty(level)}
                  className="flex min-h-16 shrink-0 flex-col justify-center rounded-2xl border-2 border-bloom-200 px-5 text-left text-ink-900"
                >
                  <span className="text-lg font-bold">{copy.difficulties[level].label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
            >
              {copy.sheet.close}
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-center text-xl font-bold">
              {choices.length > 1 ? copy.sheet.chooseMode : copy.sheet.start}
            </h2>
            {selected && (
              <p className="mt-1 text-center text-sm text-ink-400">
                {copy.sheet.levelIs(copy.difficulties[selected].label)}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => chooseMode(choice)}
                  className={`flex min-h-16 flex-col justify-center rounded-2xl px-5 text-left ${
                    // 先頭を勧める(並び順がそのまま勧める順)
                    index === 0 ? 'bg-bloom-700 text-white' : 'border-2 border-bloom-200 text-ink-900'
                  }`}
                >
                  <span className="text-lg font-bold">{copy.answerModes[choice.id].label}</span>
                  <span className={`text-sm ${index === 0 ? 'text-bloom-100' : 'text-ink-600'}`}>
                    {copy.answerModes[choice.id].note}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={backToDifficulty}
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
            >
              {copy.sheet.backToDifficulty}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
