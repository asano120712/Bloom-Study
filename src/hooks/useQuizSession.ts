import { useCallback, useEffect, useState } from 'react'
import { canServe, quizSource } from '@/services/quizSource'
import { readSession, writeSession } from '@/services/quizSession'
import type { Difficulty, GenreId, InputMode, Question } from '@/types'

/**
 * 保存してあった出題セットのうち、いまも出せる問題だけを復元する。
 *
 * 保存したあとに出題の条件が変わることがある(こたえかたの作り替え、問題データの更新)。
 * 残っていた問題をそのまま出すと、画面がその問題を描けずに入力欄ごと消える
 * (パーツを組むモードを2枠に変えたとき、古いセットの8割で「こたえあわせ」が出なくなった)。
 *
 * 位置は、出し終わった分のうち残った問題の数に読み替える。
 * 落とした問題のぶんだけ前に詰めないと、飛ばした問題がもう一度出てしまう。
 */
function restoreSession(genreId: GenreId, inputMode: InputMode, difficulty: Difficulty) {
  const stored = readSession(genreId, inputMode, difficulty)
  if (!stored) return null

  const questions = stored.questions.filter((q) => canServe(q, inputMode, difficulty))
  const cursor = stored.questions
    .slice(0, stored.cursor)
    .filter((q) => canServe(q, inputMode, difficulty)).length

  // 残りが無くなったら取り直させる
  if (cursor >= questions.length) return null

  return { questions, cursor }
}

/**
 * ジャンルの出題セットを用意する。
 * タブ内に進行中のセットがあれば復元し、無ければ quizSource から取り直す。
 *
 * 出した問題にはその場で印を付ける(presented)。
 * 答えずに離れた問題は次に入ったとき読み飛ばされるので、
 * 「戻ってまた入ると同じ問題」にはならない。
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
    genreId ? restoreSession(genreId, inputMode, difficulty) : null,
  )
  const [questions, setQuestions] = useState<Question[]>(restored?.questions ?? [])
  const [isLoading, setIsLoading] = useState(restored === null)

  /** このマウント中は動かない。1問答えるたびに結果画面へ遷移するため */
  const cursor = restored?.cursor ?? 0

  useEffect(() => {
    if (!genreId) return

    if (restored) {
      // 復元した問題も「出した」ことにする。答えずに離れたらつぎの問題へ送るため
      writeSession(genreId, inputMode, difficulty, { ...restored, presented: true })
      return
    }

    let active = true
    quizSource.startSession(genreId, inputMode, difficulty).then((session) => {
      if (!active) return
      writeSession(genreId, inputMode, difficulty, {
        questions: session.questions,
        cursor: 0,
        presented: true,
      })
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
   *
   * つぎの問題はまだ出していないので presented は下ろす。
   * (下ろさないと、結果画面から「つぎへ」で1問飛ばしてしまう)
   */
  const commitAdvance = useCallback(() => {
    if (!genreId) return
    writeSession(genreId, inputMode, difficulty, {
      questions,
      cursor: cursor + 1,
      presented: false,
    })
  }, [genreId, inputMode, difficulty, questions, cursor])

  return { questions, cursor, isLoading, commitAdvance }
}
