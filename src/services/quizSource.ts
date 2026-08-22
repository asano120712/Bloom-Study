import { questionsOf } from '@/data/questions'
import type { GenreId, Question } from '@/types'

/**
 * 1回分の出題セット。
 * 何問入っているかを決めるのは取得側で、画面はこれがすべてだとして扱う。
 * カタログの総数や未出題の残りは意図的に渡さない。
 */
export interface QuizSession {
  genreId: GenreId
  questions: Question[]
}

/**
 * 出題セットの取得口。
 *
 * 「全問リストを返して画面側が切り出す」形にしていないのは、
 * プランに応じた問題数の出し分け(要件定義書7章)を後から足せなくなるため。
 * 何問返すかの判断をこの層の内側に閉じておけば、
 * 制限を足すときも画面を触らずに済む。
 */
export interface QuizSource {
  startSession(genreId: GenreId): Promise<QuizSession>
}

/** Fisher-Yates。出題順を決めるのも取得側の責務なのでここで混ぜる。 */
function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * MVP用。回数制限を設けず、そのジャンルの全問をシャッフルして返す。
 *
 * 出題数の上限(無料トライアル、プラン別の出し分け)を入れるときは、
 * この関数の中で切るか、同じ QuizSource を実装したサーバー版に差し替える。
 * 画面は返ってきた数がすべてだとして扱うので、どちらでも QuizPage は変わらない。
 */
export const localQuizSource: QuizSource = {
  async startSession(genreId) {
    return {
      genreId,
      questions: shuffle(questionsOf(genreId)),
    }
  },
}

export const quizSource: QuizSource = localQuizSource
