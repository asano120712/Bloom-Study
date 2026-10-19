import type { Difficulty, GenreId, InputMode, MathTopic, Question } from '@/types'

/** 出題セットと、その中でつぎに出す位置 */
export interface SessionCursor {
  questions: Question[]
  cursor: number
}

/**
 * 進行中の出題セットと、その中での位置。
 *
 * 結果画面をはさんで出題画面に戻ってきても同じ問題を繰り返さないよう、
 * タブ単位(sessionStorage)で保持する。
 * 出題順をシャッフルするようになったため、位置だけでなく問題そのものを持つ。
 * (位置だけだと、戻ってきたときに別のシャッフル結果を指してしまう)
 */
export interface StoredSession extends SessionCursor {
  /**
   * cursor の問題をすでに画面に出したか。
   *
   * 答えずに出題画面を離れた問題は「もう見た問題」として捨てる。
   * これが無いと、ジャンル選択へ戻ってから入り直すたびに同じ問題が出てしまう。
   */
  presented: boolean
}

/**
 * 問題の形が変わったら版を上げる。開いたままのタブに残っている
 * 古い形の出題セット(読みだけの漢字問題など)を復元させないため。
 */
const KEY_PREFIX = 'bloomstudy:session:v4:'

/**
 * 入力方法・難易度・計算の種類で出せる問題が変わるため、セッションはその組み合わせごとに分ける。
 * (難易度や種類を切り替えて戻ったとき、別の条件の途中セットを復元しないようにする)
 * 種類が無い(ランダム)ときは、種類を持つ前と同じ鍵になる。
 */
const keyOf = (
  genreId: GenreId,
  inputMode: InputMode,
  difficulty: Difficulty,
  topic: MathTopic | undefined,
) => `${KEY_PREFIX}${genreId}:${inputMode}:${difficulty}${topic ? `:${topic}` : ''}`

/**
 * 中断していたセットの「つぎに出す問題」を返す。
 * 画面に出したまま離れた問題は読み飛ばすので、入り直すと必ず別の問題になる。
 */
export function readSession(
  genreId: GenreId,
  inputMode: InputMode,
  difficulty: Difficulty,
  topic: MathTopic | undefined,
): SessionCursor | null {
  try {
    const raw = sessionStorage.getItem(keyOf(genreId, inputMode, difficulty, topic))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!Array.isArray(parsed.questions) || typeof parsed.cursor !== 'number') return null

    const cursor = parsed.presented ? parsed.cursor + 1 : parsed.cursor
    // 出し切ったセットは無効。呼び出し側に取り直させる
    if (cursor >= parsed.questions.length) return null

    return { questions: parsed.questions, cursor }
  } catch {
    // プライベートモードなど sessionStorage が使えない環境では毎回取り直す
    return null
  }
}

export function writeSession(
  genreId: GenreId,
  inputMode: InputMode,
  difficulty: Difficulty,
  topic: MathTopic | undefined,
  session: StoredSession,
): void {
  try {
    sessionStorage.setItem(keyOf(genreId, inputMode, difficulty, topic), JSON.stringify(session))
  } catch {
    // 保存できなくても、そのタブ内での出題は最後まで続けられる
  }
}
