import type { GenreId, InputMode, Question } from '@/types'

/**
 * 進行中の出題セットと、その中での位置。
 *
 * 結果画面をはさんで出題画面に戻ってきても同じ問題を繰り返さないよう、
 * タブ単位(sessionStorage)で保持する。
 * 出題順をシャッフルするようになったため、位置だけでなく問題そのものを持つ。
 * (位置だけだと、戻ってきたときに別のシャッフル結果を指してしまう)
 */
export interface StoredSession {
  questions: Question[]
  cursor: number
}

const KEY_PREFIX = 'bloomstudy:session:'

/** 入力方法で出せる問題が変わるため、セッションはこたえかたごとに分ける */
const keyOf = (genreId: GenreId, inputMode: InputMode) => `${KEY_PREFIX}${genreId}:${inputMode}`

export function readSession(genreId: GenreId, inputMode: InputMode): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(keyOf(genreId, inputMode))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!Array.isArray(parsed.questions) || typeof parsed.cursor !== 'number') return null
    // 出し切ったセットは無効。呼び出し側に取り直させる
    if (parsed.cursor >= parsed.questions.length) return null

    return { questions: parsed.questions, cursor: parsed.cursor }
  } catch {
    // プライベートモードなど sessionStorage が使えない環境では毎回取り直す
    return null
  }
}

export function writeSession(genreId: GenreId, inputMode: InputMode, session: StoredSession): void {
  try {
    sessionStorage.setItem(keyOf(genreId, inputMode), JSON.stringify(session))
  } catch {
    // 保存できなくても、そのタブ内での出題は最後まで続けられる
  }
}
