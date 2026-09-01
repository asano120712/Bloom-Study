import { useCallback, useEffect, useState } from 'react'
import { quizSource } from '@/services/quizSource'
import { readSession, writeSession } from '@/services/quizSession'
import type { Difficulty, GenreId, InputMode, Question } from '@/types'

/**
 * ジャンルの出題セットを用意する。
 * タブ内に進行中のセットがあれば復元し、無ければ quizSource から取り直す。
 *
 * 前提: 出題画面はジャンルごとにマウントし直される
 * (別ジャンルへは必ずジャンル選択画面を経由するため)。
 * 同じ画面のまま genreId だけ差し替える導線を足すときは、
 * 復元処理を genreId の変化に追従させること。
 */
export function useQuizSession(
  genreId: GenreId | undefined,
  inputMode: InputMode,
  difficulty: Difficulty,
) {
  // sessionStorage は同期に読めるので、初回描画の時点で確定させる。
  // effect の中で復元すると、問題が無い状態が1フレーム描画される。
  const [restored] = useState(() =>
    genreId ? readSession(genreId, inputMode, difficulty) : null,
  )
  const [questions, setQuestions] = useState<Question[]>(restored?.questions ?? [])
  const [isLoading, setIsLoading] = useState(restored === null)

  /** このマウント中は動かない。1問答えるたびに結果画面へ遷移するため */
  const cursor = restored?.cursor ?? 0

  useEffect(() => {
    if (!genreId || restored) return

    let active = true
    quizSource.startSession(genreId, inputMode, difficulty).then((session) => {
      if (!active) return
      writeSession(genreId, inputMode, difficulty, { questions: session.questions, cursor: 0 })
      setQuestions(session.questions)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [genreId, inputMode, difficulty, restored])

  /**
   * 1問進んだことを記録する。
   * 直後に結果画面へ遷移するので、あえて React の state は動かさない。
   * (動かすと再描画が挟まり、問題が無い状態が一瞬描画される)
   */
  const commitAdvance = useCallback(() => {
    if (!genreId) return
    writeSession(genreId, inputMode, difficulty, { questions, cursor: cursor + 1 })
  }, [genreId, inputMode, difficulty, questions, cursor])

  return { questions, cursor, isLoading, commitAdvance }
}
