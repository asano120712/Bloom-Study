import { questionsOf } from '@/data/questions'
import { assemblyOf } from '@/features/assemble'
import type { Difficulty, GenreId, InputMode, Question } from '@/types'

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
  startSession(
    genreId: GenreId,
    inputMode: InputMode,
    difficulty: Difficulty,
  ): Promise<QuizSession>
}

/**
 * その入力方法で出題できる問題か。
 *
 * assemble は「へん+つくり」を左右2枠に組ませるので、左右に割れる字
 * (assemblyOf が成立する字)だけを配る。それ以外を混ぜると、選んだはずの
 * こたえかたと違う画面が出てしまう。
 */
function isAnswerable(question: Question, inputMode: InputMode): boolean {
  if (inputMode === 'assemble') return assemblyOf(question) !== null
  return true
}

/**
 * いまその問題を配ってよいか。出題セットを作るときの条件そのもの。
 *
 * 保存した出題セットを復元する側にも同じ判断が要るので公開している。
 * こたえかたの作り替えや問題データの更新で条件が変わると、
 * 保存済みのセットには「いまは出せない問題」が残る。
 * それをそのまま出すと、画面はその問題を描けず入力欄ごと消える。
 */
export function canServe(
  question: Question,
  inputMode: InputMode,
  difficulty: Difficulty,
): boolean {
  return isAnswerable(question, inputMode) && matchesDifficulty(question, difficulty)
}

/**
 * 選んだ難易度の問題か。難易度未設定の古い問題は「ふつう」とみなす
 * (level を持たない問題が難易度選択で完全に出せなくならないように)。
 */
function matchesDifficulty(question: Question, difficulty: Difficulty): boolean {
  return (question.level ?? 'normal') === difficulty
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
 * MVP用。回数制限を設けず、その入力方法で出せる問題を全部シャッフルして返す。
 *
 * 出題数の上限(無料トライアル、プラン別の出し分け)を入れるときは、
 * この関数の中で切るか、同じ QuizSource を実装したサーバー版に差し替える。
 * 画面は返ってきた数がすべてだとして扱うので、どちらでも QuizPage は変わらない。
 */
export const localQuizSource: QuizSource = {
  async startSession(genreId, inputMode, difficulty) {
    return {
      genreId,
      questions: shuffle(
        questionsOf(genreId).filter((q) => canServe(q, inputMode, difficulty)),
      ),
    }
  },
}

export const quizSource: QuizSource = localQuizSource
